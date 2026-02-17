import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Select, Space, Typography, message as antdMessage } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';

const { Title, Text } = Typography;

const AdminBrandsPanel = () => {
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbProvisioning, setKbProvisioning] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [form] = Form.useForm();
  const selectedKnowledgeBaseId = Form.useWatch('knowledgeBaseId', form);

  const loadBrands = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/brands');
      const brandList = data.brands || [];
      setBrands(brandList);
      if (!selectedBrandId && brandList.length) {
        setSelectedBrandId(brandList[0].id);
      }
    } catch {
      antdMessage.error('No se pudieron cargar las marcas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadKnowledgeBases = useCallback(async (brandId) => {
    if (!brandId) {
      setKnowledgeBases([]);
      setKbLoading(false);
      return;
    }

    setKbLoading(true);
    try {
      const { data } = await api.get('/admin/knowledge-bases', {
        headers: {
          'x-brand-id': brandId
        }
      });
      setKnowledgeBases(Array.isArray(data.knowledgeBases) ? data.knowledgeBases : []);
    } catch (error) {
      antdMessage.error(error.response?.data?.error || 'No se pudieron cargar las Knowledge Bases');
      setKnowledgeBases([]);
    } finally {
      setKbLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedBrandId) {
      form.resetFields();
      return;
    }
    const brand = brands.find((item) => item.id === selectedBrandId);
    if (!brand) return;
    form.setFieldsValue({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      modelId: brand.modelId || brand.assistantId,
      knowledgeBaseId: brand.knowledgeBaseId || brand.vectorStoreId,
      knowledgeBaseStatus: brand.knowledgeBaseStatus,
      guardrailId: brand.guardrailId,
      kbDataSourceId: brand.kbDataSourceId,
      kbS3Prefix: brand.kbS3Prefix,
      measurementModel: brand.measurement?.model,
      measurementSampleSize: brand.measurement?.sampleSize,
      measurementCron: brand.measurement?.cron,
      prompts: brand.measurement?.prompts || []
    });
  }, [selectedBrandId, brands, form]);

  useEffect(() => {
    loadKnowledgeBases(selectedBrandId);
  }, [selectedBrandId, loadKnowledgeBases]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        name: values.name,
        slug: values.slug,
        description: values.description,
        modelId: values.modelId,
        knowledgeBaseId: values.knowledgeBaseId || null,
        knowledgeBaseStatus: values.knowledgeBaseStatus || null,
        guardrailId: values.guardrailId || null,
        kbDataSourceId: values.kbDataSourceId || null,
        kbS3Prefix: values.kbS3Prefix || null,
        assistantId: values.modelId,
        vectorStoreId: values.knowledgeBaseId || null,
        measurement: {
          model: values.measurementModel,
          sampleSize: values.measurementSampleSize,
          cron: values.measurementCron,
          prompts: values.prompts || []
        }
      };
      if (values.id) {
        await api.put(`/brands/${values.id}`, payload);
        antdMessage.success('Marca actualizada');
      } else {
        const { data } = await api.post('/brands', payload);
        antdMessage.success('Marca creada');
        setSelectedBrandId(data.brand?.id || null);
      }
      loadBrands();
    } catch (error) {
      if (error?.errorFields) return;
      const message = error.response?.data?.error || 'No se pudo guardar la marca';
      antdMessage.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleProvisionKnowledgeBase = async () => {
    if (!selectedBrandId) {
      antdMessage.warning('Primero selecciona una marca existente');
      return;
    }

    const modelId = form.getFieldValue('modelId');
    if (!modelId || !String(modelId).trim()) {
      antdMessage.warning('Define un Model ID antes de crear la KB');
      return;
    }

    setKbProvisioning(true);
    try {
      const { data } = await api.post(
        '/admin/knowledge-base/provision',
        {
          modelId: String(modelId).trim()
        },
        {
          headers: {
            'x-brand-id': selectedBrandId
          }
        }
      );

      const updatedBrand = data.brand || {};
      form.setFieldsValue({
        modelId: updatedBrand.modelId || modelId,
        knowledgeBaseId: updatedBrand.knowledgeBaseId || '',
        knowledgeBaseStatus: updatedBrand.knowledgeBaseStatus || '',
        kbDataSourceId: updatedBrand.kbDataSourceId || '',
        kbS3Prefix: updatedBrand.kbS3Prefix || ''
      });

      await Promise.all([loadBrands(), loadKnowledgeBases(selectedBrandId)]);
      antdMessage.success('Knowledge Base creada o vinculada');
    } catch (error) {
      antdMessage.error(error.response?.data?.error || 'No se pudo crear la Knowledge Base');
    } finally {
      setKbProvisioning(false);
    }
  };

  const brandOptions = useMemo(
    () => brands.map((brand) => ({ label: brand.name, value: brand.id })),
    [brands]
  );

  const knowledgeBaseOptions = useMemo(() => {
    const options = knowledgeBases
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

  const startNewBrand = () => {
    setSelectedBrandId(null);
    form.resetFields();
  };

  return (
    <div className="admin-brands-panel">
      <Card loading={loading}>
        <div className="panel-header">
          <div>
            <Title level={4} style={{ marginBottom: 0 }}>
              Configuración de marcas
            </Title>
            <Text type="secondary">Administra modelo Bedrock, Knowledge Base y parámetros por marca.</Text>
          </div>
          <Space>
            <Select
              placeholder="Selecciona una marca"
              value={selectedBrandId}
              options={brandOptions}
              onChange={setSelectedBrandId}
              allowClear
              style={{ minWidth: 200 }}
            />
            <Button icon={<PlusOutlined />} onClick={startNewBrand}>
              Nueva marca
            </Button>
          </Space>
        </div>
        <Form layout="vertical" form={form} style={{ marginTop: 24 }}>
          <Form.Item name="id" label="ID" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="Nombre" name="name" rules={[{ required: true, message: 'Ingresa el nombre de la marca' }]}> 
            <Input placeholder="Nombre de la marca" />
          </Form.Item>
          <Form.Item label="Slug" name="slug">
            <Input placeholder="slug-unico" />
          </Form.Item>
          <Form.Item label="Descripción" name="description">
            <Input.TextArea rows={2} placeholder="Información adicional" />
          </Form.Item>
          <Form.Item label="Model ID" name="modelId" rules={[{ required: true, message: 'Model ID requerido' }]}> 
            <Input placeholder="anthropic.claude-3-5-haiku-20241022-v1:0" />
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
                  form.setFieldValue('knowledgeBaseId', value || '');
                }}
                style={{ width: '100%' }}
              />
              <Button
                type="default"
                onClick={handleProvisionKnowledgeBase}
                loading={kbProvisioning}
                disabled={saving}
              >
                Crear KB
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="Knowledge Base ID" name="knowledgeBaseId">
            <Input placeholder="kb-xxxxxxxx" />
          </Form.Item>
          <Form.Item label="Estado Knowledge Base" name="knowledgeBaseStatus">
            <Input placeholder="ACTIVE / CREATING / PENDING_CONFIG" />
          </Form.Item>
          <Form.Item label="Guardrail ID" name="guardrailId">
            <Input placeholder="gr-xxxxxxxx" />
          </Form.Item>
          <Form.Item label="Data Source ID" name="kbDataSourceId">
            <Input placeholder="ds-xxxxxxxx" />
          </Form.Item>
          <Form.Item label="S3 Prefix KB" name="kbS3Prefix">
            <Input placeholder="kb/gynocanesten/" />
          </Form.Item>
          <Form.Item label="Modelo de medición" name="measurementModel">
            <Input placeholder="anthropic.claude-3-5-haiku-20241022-v1:0" />
          </Form.Item>
          <Form.Item label="Muestras por día" name="measurementSampleSize">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Cron de medición" name="measurementCron">
            <Input placeholder="0 6 * * *" />
          </Form.Item>
          <Form.List name="prompts">
            {(fields, { add, remove }) => (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>Prompts de medición</Text>
                  <Button type="link" icon={<PlusOutlined />} onClick={() => add({ key: '', label: '', promptType: '', question: '' })}>
                    Agregar
                  </Button>
                </div>
                {fields.map((field) => (
                  <Card key={field.key} size="small" style={{ marginBottom: 12 }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Form.Item label="Clave" name={[field.name, 'key']} rules={[{ required: true, message: 'Clave requerida' }]}>
                        <Input placeholder="Ej. brand" />
                      </Form.Item>
                      <Form.Item label="Etiqueta" name={[field.name, 'label']}>
                        <Input placeholder="Nombre mostrado" />
                      </Form.Item>
                      <Form.Item label="Tipo interno" name={[field.name, 'promptType']}>
                        <Input placeholder="Identificador interno" />
                      </Form.Item>
                      <Form.Item label="Pregunta" name={[field.name, 'question']} rules={[{ required: true, message: 'Pregunta requerida' }]}>
                        <Input.TextArea rows={3} placeholder="Texto del prompt" />
                      </Form.Item>
                      <Button danger type="link" icon={<DeleteOutlined />} onClick={() => remove(field.name)}>
                        Eliminar
                      </Button>
                    </Space>
                  </Card>
                ))}
              </div>
            )}
          </Form.List>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
            <Button type="primary" onClick={handleSave} loading={saving}>
              Guardar
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default AdminBrandsPanel;
