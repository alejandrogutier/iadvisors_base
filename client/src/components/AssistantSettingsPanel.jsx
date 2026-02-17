import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message as antdMessage
} from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import api from '../api';
import { useBrand } from '../context/BrandContext';

const { Text, Title } = Typography;

const AssistantSettingsPanel = () => {
  const [form] = Form.useForm();
  const [assistant, setAssistant] = useState(null);
  const [models, setModels] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbProvisioning, setKbProvisioning] = useState(false);
  const { currentBrand, withBrandHeaders } = useBrand();
  const selectedModel = Form.useWatch('model', form);
  const selectedKnowledgeBaseId = Form.useWatch('knowledge_base_id', form);

  const loadAssistant = useCallback(async () => {
    if (!currentBrand?.id) {
      setAssistant(null);
      setModels([]);
      setKnowledgeBases([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/admin/assistant', withBrandHeaders());
      const loadedAssistant = data.assistant || {};
      setAssistant(loadedAssistant);
      setModels(data.models || []);

      form.setFieldsValue({
        model: loadedAssistant.model || '',
        instructions: loadedAssistant.instructions || '',
        temperature:
          typeof loadedAssistant.temperature === 'number'
            ? loadedAssistant.temperature
            : null,
        top_p:
          typeof loadedAssistant.top_p === 'number' ? loadedAssistant.top_p : null,
        max_tokens:
          typeof loadedAssistant.max_tokens === 'number'
            ? loadedAssistant.max_tokens
            : null,
        guardrail_id: loadedAssistant.guardrail_id || '',
        knowledge_base_id: loadedAssistant.knowledge_base_id || '',
        knowledge_base_status: loadedAssistant.knowledge_base_status || ''
      });
    } catch (error) {
      const message = error.response?.data?.error || 'No se pudo cargar la configuración';
      antdMessage.error(message);
    } finally {
      setLoading(false);
    }
  }, [currentBrand?.id, form, withBrandHeaders]);

  const loadKnowledgeBases = useCallback(async () => {
    if (!currentBrand?.id) {
      setKnowledgeBases([]);
      setKbLoading(false);
      return;
    }
    setKbLoading(true);
    try {
      const { data } = await api.get('/admin/knowledge-bases', withBrandHeaders());
      setKnowledgeBases(Array.isArray(data.knowledgeBases) ? data.knowledgeBases : []);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'No se pudieron cargar las Knowledge Bases';
      antdMessage.error(errorMessage);
    } finally {
      setKbLoading(false);
    }
  }, [currentBrand?.id, withBrandHeaders]);

  useEffect(() => {
    loadAssistant();
    loadKnowledgeBases();
  }, [loadAssistant, loadKnowledgeBases]);

  const modelOptions = useMemo(() => {
    const map = new Map();
    (models || []).forEach((model) => {
      if (!model?.id) return;
      map.set(model.id, {
        value: model.id,
        label: `${model.id}${model.providerName ? ` · ${model.providerName}` : ''}`
      });
    });
    return Array.from(map.values()).sort((a, b) => a.value.localeCompare(b.value));
  }, [models]);

  const knowledgeBaseOptions = useMemo(() => {
    const options = (knowledgeBases || [])
      .filter((kb) => kb?.id)
      .map((kb) => ({
        value: kb.id,
        label: `${kb.name || kb.id}${kb.status ? ` · ${kb.status}` : ''}`
      }));

    if (
      selectedKnowledgeBaseId &&
      !options.some((option) => option.value === selectedKnowledgeBaseId)
    ) {
      options.push({
        value: selectedKnowledgeBaseId,
        label: `${selectedKnowledgeBaseId} · actual`
      });
    }

    return options.sort((a, b) => a.value.localeCompare(b.value));
  }, [knowledgeBases, selectedKnowledgeBaseId]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await api.put('/admin/assistant', values, withBrandHeaders());
      antdMessage.success('Configuración Bedrock actualizada');
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

  const handleProvisionKnowledgeBase = async () => {
    setKbProvisioning(true);
    try {
      const { data } = await api.post(
        '/admin/knowledge-base/provision',
        {
          modelId: selectedModel || null
        },
        withBrandHeaders()
      );

      const brand = data.brand || {};
      form.setFieldsValue({
        model: brand.modelId || selectedModel || '',
        knowledge_base_id: brand.knowledgeBaseId || '',
        knowledge_base_status: brand.knowledgeBaseStatus || ''
      });
      antdMessage.success('Knowledge Base provisionada o vinculada');
      await loadKnowledgeBases();
      await loadAssistant();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'No se pudo provisionar la Knowledge Base';
      antdMessage.error(errorMessage);
    } finally {
      setKbProvisioning(false);
    }
  };

  if (!currentBrand) {
    return (
      <Card>
        <Typography.Text type="secondary">Selecciona una marca para editar la configuración Bedrock.</Typography.Text>
      </Card>
    );
  }

  return (
    <div className="assistant-settings-panel">
      <div className="panel-header">
        <div>
          <Title level={4} style={{ marginBottom: 0 }}>
            Configuración Bedrock
          </Title>
          <Text type="secondary">Modelo, instrucciones, guardrails y acoplamiento a Knowledge Base.</Text>
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
          {assistant?.id && <Tag color="blue">Marca: {assistant.id}</Tag>}
          {assistant?.model && <Tag color="geekblue">Modelo: {assistant.model}</Tag>}
          {assistant?.knowledge_base_id && <Tag color="green">KB: {assistant.knowledge_base_id}</Tag>}
          {assistant?.knowledge_base_status && (
            <Tag color="purple">Estado KB: {assistant.knowledge_base_status}</Tag>
          )}
        </div>
        <Spin spinning={loading} tip="Consultando configuración">
          <Form form={form} layout="vertical" className="assistant-settings-form">
            <Form.Item label="Modelo Bedrock" name="model" rules={[{ required: true, message: 'Modelo requerido' }]}>
              <Select
                showSearch
                allowClear
                placeholder="Selecciona o escribe un modelId"
                options={modelOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item label="Instrucciones" name="instructions">
              <Input.TextArea rows={6} placeholder="Instrucciones base del asistente" />
            </Form.Item>
            <Form.Item label="Temperature" name="temperature">
              <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="Top P" name="top_p">
              <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="Max tokens" name="max_tokens">
              <InputNumber min={1} max={8192} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="Guardrail ID" name="guardrail_id">
              <Input placeholder="gr-xxxxxxxx" />
            </Form.Item>
            <Form.Item label="Seleccionar KB existente">
              <Space.Compact block>
                <Select
                  allowClear
                  showSearch
                  placeholder="Selecciona una Knowledge Base"
                  options={knowledgeBaseOptions}
                  optionFilterProp="label"
                  loading={kbLoading}
                  value={selectedKnowledgeBaseId || undefined}
                  onChange={(value) => {
                    form.setFieldValue('knowledge_base_id', value || '');
                  }}
                  style={{ width: '100%' }}
                />
                <Button
                  type="default"
                  onClick={handleProvisionKnowledgeBase}
                  loading={kbProvisioning}
                  disabled={loading || saving}
                >
                  Crear KB
                </Button>
              </Space.Compact>
            </Form.Item>
            <Form.Item label="Knowledge Base ID" name="knowledge_base_id">
              <Input placeholder="kb-xxxxxxxx" />
            </Form.Item>
            <Form.Item label="Estado Knowledge Base" name="knowledge_base_status">
              <Input placeholder="ACTIVE / CREATING / FAILED / PENDING_CONFIG" />
            </Form.Item>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};

export default AssistantSettingsPanel;
