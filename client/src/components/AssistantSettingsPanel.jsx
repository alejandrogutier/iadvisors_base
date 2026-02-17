import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Select,
  Spin,
  Switch,
  Tag,
  Typography,
  message as antdMessage
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined
} from '@ant-design/icons';
import api from '../api';
import { useBrand } from '../context/BrandContext';

const ASSISTANT_MODEL_PREFIXES = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'];
const DISALLOWED_MODEL_KEYWORDS = [
  'dall-e',
  'tts',
  'audio',
  'image',
  'vision',
  'whisper',
  'realtime',
  'search',
  'transcribe',
  'codex',
  'o1',
  'o3',
  'o4'
];
const MODELS_WITHOUT_SAMPLING_PARAMS = ['o1', 'o3'];

const isAssistantCompatibleModel = (modelId = '') => {
  const normalized = modelId.toLowerCase();
  if (!normalized) return false;
  if (DISALLOWED_MODEL_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return false;
  }
  if (normalized.startsWith('ft:')) return true;
  return ASSISTANT_MODEL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const disablesSamplingParams = (modelId = '') => {
  const normalized = modelId.toLowerCase();
  if (!normalized) return false;
  return MODELS_WITHOUT_SAMPLING_PARAMS.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}-`)
  );
};

const { Text, Title, Paragraph } = Typography;

const AssistantSettingsPanel = () => {
  const [form] = Form.useForm();
  const [assistant, setAssistant] = useState(null);
  const [models, setModels] = useState([]);
  const [metadataRows, setMetadataRows] = useState([]);
  const [toolFlags, setToolFlags] = useState({
    code_interpreter: false,
    file_search: false
  });
  const [vectorStoreIds, setVectorStoreIds] = useState([]);
  const [responseFormat, setResponseFormat] = useState('');
  const [rawToolResources, setRawToolResources] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectedModelId = Form.useWatch('model', form);
  const samplingParamsDisabled = useMemo(
    () => disablesSamplingParams(selectedModelId),
    [selectedModelId]
  );
  const { currentBrand, withBrandHeaders } = useBrand();

  useEffect(() => {
    if (samplingParamsDisabled) {
      form.setFieldsValue({ temperature: null, top_p: null });
    }
  }, [form, samplingParamsDisabled]);

  const formatDate = (value) => {
    if (!value) return '';
    const numericValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && !Number.isNaN(Number(value))
          ? Number(value)
          : null;
    const date = numericValue
      ? new Date(numericValue > 1e12 ? numericValue : numericValue * 1000)
      : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString('es-MX');
  };

  const loadAssistant = useCallback(async () => {
    if (!currentBrand?.id) {
      setAssistant(null);
      setModels([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/admin/assistant', withBrandHeaders());
      const loadedAssistant = data.assistant || {};
      setAssistant(loadedAssistant);
      setModels(data.models || []);
      setRawToolResources(loadedAssistant.tool_resources || {});
      form.setFieldsValue({
        name: loadedAssistant.name || '',
        description: loadedAssistant.description || '',
        instructions: loadedAssistant.instructions || '',
        model: loadedAssistant.model || '',
        temperature:
          typeof loadedAssistant.temperature === 'number'
            ? loadedAssistant.temperature
            : null,
        top_p:
          typeof loadedAssistant.top_p === 'number' ? loadedAssistant.top_p : null
      });

      const entries = Object.entries(loadedAssistant.metadata || {}).map(
        ([key, value]) => ({
          key,
          value: value == null ? '' : String(value)
        })
      );
      setMetadataRows(entries);

      setToolFlags({
        code_interpreter: Array.isArray(loadedAssistant.tools)
          ? loadedAssistant.tools.some((tool) => tool.type === 'code_interpreter')
          : false,
        file_search: Array.isArray(loadedAssistant.tools)
          ? loadedAssistant.tools.some((tool) => tool.type === 'file_search')
          : false
      });

      const vectorIds = Array.isArray(
        loadedAssistant.tool_resources?.file_search?.vector_store_ids
      )
        ? loadedAssistant.tool_resources.file_search.vector_store_ids
        : [];
      const normalizedVectorIds = vectorIds
        .map((id) => {
          if (typeof id === 'string') return id;
          if (id == null) return '';
          return String(id);
        })
        .map((value) => value.trim())
        .filter(Boolean);
      setVectorStoreIds(normalizedVectorIds);

      setResponseFormat(
        loadedAssistant.response_format
          ? JSON.stringify(loadedAssistant.response_format, null, 2)
          : ''
      );
    } catch (error) {
      const message = error.response?.data?.error || 'No se pudo cargar la configuración';
      antdMessage.error(message);
    } finally {
      setLoading(false);
    }
  }, [form, currentBrand?.id, withBrandHeaders]);

  useEffect(() => {
    loadAssistant();
  }, [loadAssistant]);

  const modelOptions = useMemo(() => {
    const optionsMap = new Map();
    models.forEach((model) => {
      if (!model?.id) return;
      const shouldInclude = isAssistantCompatibleModel(model.id) || model.id === assistant?.model;
      if (!shouldInclude || optionsMap.has(model.id)) {
        return;
      }
      optionsMap.set(model.id, {
        value: model.id,
        label: `${model.id}${model.owned_by ? ` · ${model.owned_by}` : ''}`
      });
    });

    return Array.from(optionsMap.values()).sort((a, b) => a.value.localeCompare(b.value));
  }, [assistant?.model, models]);

  const assistantUpdatedAt = useMemo(() => {
    if (!assistant?.updated_at) return '';
    return formatDate(assistant.updated_at);
  }, [assistant?.updated_at]);

  const addMetadataRow = () => {
    setMetadataRows((prev) => [...prev, { key: '', value: '' }]);
  };

  const updateMetadataRow = (index, field, value) => {
    setMetadataRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value
      };
      return next;
    });
  };

  const removeMetadataRow = (index) => {
    setMetadataRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const targetModelId = values.model || '';
      const samplingDisabledForPayload = disablesSamplingParams(targetModelId);

      const metadataPayload = {};
      metadataRows.forEach(({ key, value }) => {
        const trimmedKey = key?.trim();
        if (!trimmedKey) return;
        metadataPayload[trimmedKey] = value == null ? '' : String(value);
      });

      const toolsPayload = [];
      if (toolFlags.code_interpreter) {
        toolsPayload.push({ type: 'code_interpreter' });
      }
      if (toolFlags.file_search) {
        toolsPayload.push({ type: 'file_search' });
      }

      const cleanVectorIds = vectorStoreIds
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter(Boolean);

      let parsedResponseFormat = null;
      if (responseFormat.trim()) {
        try {
          parsedResponseFormat = JSON.parse(responseFormat);
        } catch (error) {
          antdMessage.error('El formato de respuesta debe ser un JSON válido');
          return;
        }
      }

      const preservedToolResources = {};
      Object.entries(rawToolResources || {}).forEach(([key, value]) => {
        if (key === 'file_search') {
          return;
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          preservedToolResources[key] = { ...value };
        } else {
          preservedToolResources[key] = value;
        }
      });

      if (toolFlags.file_search) {
        preservedToolResources.file_search = {
          vector_store_ids: cleanVectorIds
        };
      }

      const payload = {
        ...values,
        metadata: metadataPayload,
        tools: toolsPayload,
        response_format: parsedResponseFormat,
        tool_resources: preservedToolResources
      };

      if (samplingDisabledForPayload) {
        delete payload.temperature;
        delete payload.top_p;
      }

      setSaving(true);
      await api.put('/admin/assistant', payload, withBrandHeaders());
      antdMessage.success('Configuración del asistente actualizada');
      await loadAssistant();
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      const message = error.response?.data?.error || 'No se pudo guardar la configuración';
      antdMessage.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!currentBrand) {
    return (
      <Card>
        <Typography.Text type="secondary">Selecciona una marca para editar la configuración del asistente.</Typography.Text>
      </Card>
    );
  }

  return (
    <div className="assistant-settings-panel">
      <div className="panel-header">
        <div>
          <Title level={4} style={{ marginBottom: 0 }}>
            Parámetros del asistente
          </Title>
          <Text type="secondary">
            Consulta y actualiza la configuración registrada en OpenAI
          </Text>
        </div>
        <div className="panel-header__actions">
          <Button icon={<ReloadOutlined />} onClick={loadAssistant} disabled={loading || saving}>
            Actualizar
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={loading}
          >
            Guardar cambios
          </Button>
        </div>
      </div>

      <Card>
        <div className="assistant-settings-summary">
          {assistant?.id && <Tag color="blue">ID: {assistant.id}</Tag>}
          {assistant?.model && <Tag color="geekblue">Modelo: {assistant.model}</Tag>}
          {assistantUpdatedAt && <Tag color="default">Actualizado: {assistantUpdatedAt}</Tag>}
        </div>
        <Spin spinning={loading} tip="Consultando asistente">
          <Form form={form} layout="vertical" className="assistant-settings-form">
            <div className="assistant-settings-section">
              <Title level={5}>Identidad</Title>
              <Form.Item label="Nombre" name="name">
                <Input placeholder="Nombre visible del asistente" />
              </Form.Item>
              <Form.Item label="Descripción" name="description">
                <Input placeholder="Descripción breve para referencia" />
              </Form.Item>
              <Form.Item label="Instrucciones" name="instructions">
                <Input.TextArea rows={6} placeholder="Prompt del asistente" />
              </Form.Item>
            </div>

            <Divider />

            <div className="assistant-settings-section">
              <Title level={5}>Modelo y parámetros</Title>
              <Form.Item label="Modelo" name="model">
                <Select
                  showSearch
                  allowClear
                  placeholder="Selecciona o escribe un modelo"
                  options={modelOptions}
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
              <div className="assistant-settings-grid">
                <Form.Item
                  label="Temperatura"
                  name="temperature"
                  extra={
                    samplingParamsDisabled
                      ? 'Este modelo no soporta parámetros de muestreo (temperature, top_p).'
                      : undefined
                  }
                >
                  <InputNumber
                    min={0}
                    max={2}
                    step={0.1}
                    style={{ width: '100%' }}
                    placeholder={samplingParamsDisabled ? 'No disponible' : '1'}
                    disabled={samplingParamsDisabled}
                  />
                </Form.Item>
                <Form.Item label="Top P" name="top_p">
                  <InputNumber
                    min={0}
                    max={1}
                    step={0.05}
                    style={{ width: '100%' }}
                    placeholder={samplingParamsDisabled ? 'No disponible' : '1'}
                    disabled={samplingParamsDisabled}
                  />
                </Form.Item>
              </div>
            </div>

            <Divider />

            <div className="assistant-settings-section">
              <Title level={5}>Metadatos</Title>
              {metadataRows.length === 0 ? (
                <Text type="secondary">No hay metadatos configurados.</Text>
              ) : (
                metadataRows.map((row, index) => (
                  <div className="metadata-row" key={`metadata-${index}`}>
                    <Input
                      placeholder="Clave"
                      value={row.key}
                      onChange={(event) => updateMetadataRow(index, 'key', event.target.value)}
                      className="metadata-row__key"
                    />
                    <Input
                      placeholder="Valor"
                      value={row.value}
                      onChange={(event) => updateMetadataRow(index, 'value', event.target.value)}
                    />
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => removeMetadataRow(index)}
                    />
                  </div>
                ))
              )}
              <Button icon={<PlusOutlined />} type="dashed" onClick={addMetadataRow} style={{ marginTop: 12 }}>
                Agregar metadato
              </Button>
            </div>

            <Divider />

            <div className="assistant-settings-section">
              <Title level={5}>Herramientas</Title>
              <div className="tool-toggle">
                <div>
                  <Text strong>Code Interpreter</Text>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    Permite ejecutar código y trabajar con archivos vía sandbox
                  </Paragraph>
                </div>
                <Switch
                  checked={toolFlags.code_interpreter}
                  onChange={(checked) => setToolFlags((prev) => ({ ...prev, code_interpreter: checked }))}
                />
              </div>
              <div className="tool-toggle">
                <div>
                  <Text strong>Búsqueda en archivos</Text>
                  <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    Vincula vector stores para responder con contexto cargado
                  </Paragraph>
                  <Select
                    mode="tags"
                    value={vectorStoreIds}
                    onChange={(values) =>
                      setVectorStoreIds(
                        values
                          .map((value) => (typeof value === 'string' ? value : String(value ?? '')))
                          .map((value) => value.trim())
                          .filter(Boolean)
                      )
                    }
                    placeholder="IDs de vector stores"
                    tokenSeparators={[',', ' ']}
                    style={{ width: '100%' }}
                    disabled={!toolFlags.file_search}
                  />
                </div>
                <Switch
                  checked={toolFlags.file_search}
                  onChange={(checked) => setToolFlags((prev) => ({ ...prev, file_search: checked }))}
                />
              </div>
            </div>

            <Divider />

            <div className="assistant-settings-section">
              <Title level={5}>Formato de respuesta</Title>
              <Paragraph type="secondary">
                Ingresa un objeto JSON válido (por ejemplo, {'{ "type": "json_object" }'}). Deja vacío para usar la configuración por defecto.
              </Paragraph>
              <Input.TextArea
                rows={6}
                value={responseFormat}
                onChange={(event) => setResponseFormat(event.target.value)}
                placeholder={`{
  "type": "json_object"
}`}
              />
            </div>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};

export default AssistantSettingsPanel;
