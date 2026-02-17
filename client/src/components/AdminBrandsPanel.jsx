import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Collapse,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
  message as antdMessage
} from 'antd';
import { PlusOutlined, ReloadOutlined, SaveOutlined, PlayCircleOutlined } from '@ant-design/icons';
import api from '../api';

const { Title, Text } = Typography;

const DEFAULT_MODEL_ID = 'us.amazon.nova-lite-v1:0';

const formatDateTime = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
};

const AdminBrandsPanel = () => {
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(null);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [saving, setSaving] = useState(false);

  const [kbLoading, setKbLoading] = useState(false);
  const [kbProvisioning, setKbProvisioning] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState([]);

  const [measurementsLoading, setMeasurementsLoading] = useState(false);
  const [measurementSummary, setMeasurementSummary] = useState(null);
  const [measurementsRunning, setMeasurementsRunning] = useState(false);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);

  const [editForm] = Form.useForm();
  const [wizardForm] = Form.useForm();

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === selectedBrandId) || null,
    [brands, selectedBrandId]
  );

  const selectedKnowledgeBaseId = Form.useWatch('knowledgeBaseId', editForm);
  const selectedKnowledgeBaseStatus = Form.useWatch('knowledgeBaseStatus', editForm);

  const loadBrands = useCallback(async () => {
    setLoadingBrands(true);
    try {
      const { data } = await api.get('/brands');
      const brandList = Array.isArray(data.brands) ? data.brands : [];
      setBrands(brandList);
      if (!selectedBrandId && brandList.length) {
        setSelectedBrandId(brandList[0].id);
      }
    } catch {
      antdMessage.error('No se pudieron cargar las marcas');
    } finally {
      setLoadingBrands(false);
    }
  }, [selectedBrandId]);

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

  const loadMeasurementSummary = useCallback(async (brandId) => {
    if (!brandId) {
      setMeasurementSummary(null);
      setMeasurementsLoading(false);
      return;
    }
    setMeasurementsLoading(true);
    try {
      const { data } = await api.get('/measurements/summary', {
        headers: {
          'x-brand-id': brandId
        }
      });
      setMeasurementSummary(data || null);
    } catch (error) {
      setMeasurementSummary(null);
    } finally {
      setMeasurementsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    if (!selectedBrandId || !selectedBrand) {
      editForm.resetFields();
      setKnowledgeBases([]);
      setMeasurementSummary(null);
      return;
    }

    editForm.setFieldsValue({
      id: selectedBrand.id,
      name: selectedBrand.name,
      description: selectedBrand.description || '',
      modelId: selectedBrand.modelId || selectedBrand.assistantId || DEFAULT_MODEL_ID,
      knowledgeBaseId: selectedBrand.knowledgeBaseId || selectedBrand.vectorStoreId || '',
      knowledgeBaseStatus: selectedBrand.knowledgeBaseStatus || '',
      guardrailId: selectedBrand.guardrailId || '',
      measurementModel: selectedBrand.measurement?.model || '',
      measurementSampleSize: selectedBrand.measurement?.sampleSize ?? null,
      measurementCron: selectedBrand.measurement?.cron || ''
    });

    loadKnowledgeBases(selectedBrand.id);
    loadMeasurementSummary(selectedBrand.id);
  }, [selectedBrandId, selectedBrand, editForm, loadKnowledgeBases, loadMeasurementSummary]);

  const brandOptions = useMemo(
    () => brands.map((brand) => ({ label: brand.name, value: brand.id })),
    [brands]
  );

  const knowledgeBaseOptions = useMemo(() => {
    const options = knowledgeBases
      .filter((kb) => kb?.id)
      .map((kb) => ({
        value: kb.id,
        label: `${kb.name || kb.id}${kb.status ? ` · ${kb.status}` : ''}`,
        status: kb.status || null
      }));

    if (selectedKnowledgeBaseId && !options.some((option) => option.value === selectedKnowledgeBaseId)) {
      options.push({
        value: selectedKnowledgeBaseId,
        label: `${selectedKnowledgeBaseId} · actual`,
        status: selectedKnowledgeBaseStatus || null
      });
    }

    return options.sort((a, b) => a.value.localeCompare(b.value));
  }, [knowledgeBases, selectedKnowledgeBaseId, selectedKnowledgeBaseStatus]);

  const openWizard = () => {
    setWizardOpen(true);
    setWizardStep(0);
    wizardForm.resetFields();
    wizardForm.setFieldsValue({
      name: '',
      description: '',
      modelId: DEFAULT_MODEL_ID
    });
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setWizardStep(0);
  };

  const handleWizardNext = async () => {
    try {
      if (wizardStep === 0) {
        await wizardForm.validateFields(['name']);
      }
      if (wizardStep === 1) {
        await wizardForm.validateFields(['modelId']);
      }
      setWizardStep((prev) => Math.min(2, prev + 1));
    } catch {
      // validation errors are shown by antd
    }
  };

  const handleWizardBack = () => setWizardStep((prev) => Math.max(0, prev - 1));

  const handleWizardCreate = async () => {
    try {
      const values = await wizardForm.validateFields();
      setSaving(true);
      const payload = {
        name: values.name,
        description: values.description || '',
        modelId: String(values.modelId || DEFAULT_MODEL_ID).trim(),
        assistantId: String(values.modelId || DEFAULT_MODEL_ID).trim()
      };
      const { data } = await api.post('/brands', payload);
      antdMessage.success('Marca creada');
      closeWizard();
      await loadBrands();
      if (data.brand?.id) {
        setSelectedBrandId(data.brand.id);
      }
    } catch (error) {
      if (error?.errorFields) return;
      antdMessage.error(error.response?.data?.error || 'No se pudo crear la marca');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBrandId) return;
    try {
      const values = await editForm.validateFields();
      setSaving(true);

      const modelId = String(values.modelId || DEFAULT_MODEL_ID).trim();
      const knowledgeBaseId = values.knowledgeBaseId ? String(values.knowledgeBaseId).trim() : null;
      const payload = {
        name: values.name,
        description: values.description || '',
        modelId,
        assistantId: modelId,
        knowledgeBaseId,
        vectorStoreId: knowledgeBaseId,
        guardrailId: values.guardrailId ? String(values.guardrailId).trim() : null,
        measurement: {
          model: values.measurementModel ? String(values.measurementModel).trim() : undefined,
          sampleSize: values.measurementSampleSize ?? undefined,
          cron: values.measurementCron ? String(values.measurementCron).trim() : undefined
        }
      };

      await api.put(`/brands/${selectedBrandId}`, payload);
      antdMessage.success('Marca actualizada');
      await loadBrands();
      await loadMeasurementSummary(selectedBrandId);
    } catch (error) {
      if (error?.errorFields) return;
      antdMessage.error(error.response?.data?.error || 'No se pudo guardar la marca');
    } finally {
      setSaving(false);
    }
  };

  const handleProvisionKnowledgeBase = async () => {
    if (!selectedBrandId) return;

    const modelId = editForm.getFieldValue('modelId');
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
      editForm.setFieldsValue({
        modelId: updatedBrand.modelId || modelId,
        knowledgeBaseId: updatedBrand.knowledgeBaseId || '',
        knowledgeBaseStatus: updatedBrand.knowledgeBaseStatus || ''
      });

      await Promise.all([loadBrands(), loadKnowledgeBases(selectedBrandId)]);
      antdMessage.success('Knowledge Base creada o vinculada');
    } catch (error) {
      antdMessage.error(error.response?.data?.error || 'No se pudo crear la Knowledge Base');
    } finally {
      setKbProvisioning(false);
    }
  };

  const handleRunMeasurementsNow = async () => {
    if (!selectedBrandId) return;
    setMeasurementsRunning(true);
    try {
      await api.post(
        '/measurements/run',
        { force: true, sampleSize: 5 },
        {
          headers: {
            'x-brand-id': selectedBrandId
          }
        }
      );
      antdMessage.success('Mediciones ejecutadas');
      await loadMeasurementSummary(selectedBrandId);
    } catch (error) {
      antdMessage.error(error.response?.data?.error || 'No se pudieron ejecutar las mediciones');
    } finally {
      setMeasurementsRunning(false);
    }
  };

  return (
    <div className="admin-brands-panel">
      <Card loading={loadingBrands}>
        <div className="panel-header">
          <div>
            <Title level={4} style={{ marginBottom: 0 }}>
              Marcas
            </Title>
            <Text type="secondary">
              Crea marcas con asistente Bedrock y Knowledge Base. Los campos técnicos quedan en modo avanzado.
            </Text>
          </div>
          <Space>
            <Select
              placeholder="Selecciona una marca"
              value={selectedBrandId}
              options={brandOptions}
              onChange={setSelectedBrandId}
              allowClear
              style={{ minWidth: 240 }}
            />
            <Button icon={<ReloadOutlined />} onClick={loadBrands} disabled={saving}>
              Actualizar
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openWizard}>
              Nueva marca
            </Button>
          </Space>
        </div>

        {!selectedBrand ? (
          <div style={{ paddingTop: 16 }}>
            <Text type="secondary">Selecciona una marca para editar su configuración.</Text>
          </div>
        ) : (
          <Form layout="vertical" form={editForm} style={{ marginTop: 24 }}>
            <Form.Item name="id" hidden>
              <Input />
            </Form.Item>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <Tag color="blue">ID: {selectedBrand.id}</Tag>
              {selectedKnowledgeBaseId && <Tag color="green">KB: {selectedKnowledgeBaseId}</Tag>}
              {selectedKnowledgeBaseStatus && <Tag color="purple">Estado KB: {selectedKnowledgeBaseStatus}</Tag>}
            </div>

            <Form.Item
              label="Nombre"
              name="name"
              rules={[{ required: true, message: 'Ingresa el nombre de la marca' }]}
            >
              <Input placeholder="Nombre de la marca" />
            </Form.Item>

            <Form.Item label="Descripción" name="description">
              <Input.TextArea rows={2} placeholder="Información adicional" />
            </Form.Item>

            <Form.Item
              label="Modelo Bedrock"
              name="modelId"
              rules={[{ required: true, message: 'Model ID requerido' }]}
            >
              <Input placeholder={DEFAULT_MODEL_ID} />
            </Form.Item>

            <Divider style={{ margin: '16px 0' }} />

            <Form.Item name="knowledgeBaseId" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="knowledgeBaseStatus" hidden>
              <Input />
            </Form.Item>

            <Form.Item label="Knowledge Base">
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
                    editForm.setFieldValue('knowledgeBaseId', value || '');
                    const status = value
                      ? knowledgeBases.find((kb) => kb?.id === value)?.status || 'ACTIVE'
                      : '';
                    editForm.setFieldValue('knowledgeBaseStatus', status);
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

            <Collapse
              items={[
                {
                  key: 'measurements',
                  label: 'Mediciones (automáticas)',
                  children: (
                    <>
                      <Space style={{ marginBottom: 12 }} wrap>
                        <Button
                          icon={<PlayCircleOutlined />}
                          onClick={handleRunMeasurementsNow}
                          loading={measurementsRunning}
                          disabled={saving}
                        >
                          Ejecutar ahora (smoke)
                        </Button>
                        <Text type="secondary">
                          Última corrida:{' '}
                          {measurementsLoading
                            ? '...'
                            : formatDateTime(
                                measurementSummary?.latestRuns?.brand?.lastCreatedAt ||
                                  measurementSummary?.latestRuns?.symptoms?.lastCreatedAt
                              )}
                        </Text>
                      </Space>

                      <Form.Item label="Modelo de medición" name="measurementModel">
                        <Input placeholder={DEFAULT_MODEL_ID} />
                      </Form.Item>
                      <Form.Item label="Muestras por día" name="measurementSampleSize">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item label="Cron de medición" name="measurementCron">
                        <Input placeholder="0 6 * * *" />
                      </Form.Item>
                      <Text type="secondary">
                        El job corre automáticamente según el cron configurado por marca.
                      </Text>
                    </>
                  )
                },
                {
                  key: 'advanced',
                  label: 'Avanzado',
                  children: (
                    <>
                      <Form.Item label="Guardrail ID" name="guardrailId">
                        <Input placeholder="gr-xxxxxxxx" />
                      </Form.Item>
                      <Text type="secondary">
                        Campos técnicos como Data Source ID y prefijo S3 se gestionan automáticamente al provisionar la KB.
                      </Text>
                    </>
                  )
                }
              ]}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
              >
                Guardar cambios
              </Button>
            </div>
          </Form>
        )}
      </Card>

      <Modal
        title="Nueva marca"
        open={wizardOpen}
        onCancel={closeWizard}
        footer={null}
        destroyOnClose
      >
        <Steps
          current={wizardStep}
          items={[
            { title: 'Datos' },
            { title: 'Modelo' },
            { title: 'Finalizar' }
          ]}
          style={{ marginBottom: 24 }}
        />

        <Form form={wizardForm} layout="vertical">
          {wizardStep === 0 && (
            <>
              <Form.Item
                label="Nombre"
                name="name"
                rules={[{ required: true, message: 'Ingresa el nombre de la marca' }]}
              >
                <Input placeholder="Nombre de la marca" />
              </Form.Item>
              <Form.Item label="Descripción" name="description">
                <Input.TextArea rows={2} placeholder="Información adicional" />
              </Form.Item>
            </>
          )}

          {wizardStep === 1 && (
            <Form.Item
              label="Modelo Bedrock"
              name="modelId"
              rules={[{ required: true, message: 'Model ID requerido' }]}
            >
              <Input placeholder={DEFAULT_MODEL_ID} />
            </Form.Item>
          )}

          {wizardStep === 2 && (
            <div>
              <Text>
                Al crear la marca, el backend intentará provisionar automáticamente una Knowledge Base y su Data Source.
              </Text>
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">
                  Luego podrás subir documentos en la pestaña <strong>Vector Store</strong>.
                </Text>
              </div>
            </div>
          )}
        </Form>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <Button onClick={handleWizardBack} disabled={wizardStep === 0 || saving}>
            Atrás
          </Button>
          <Space>
            {wizardStep < 2 ? (
              <Button type="primary" onClick={handleWizardNext} disabled={saving}>
                Siguiente
              </Button>
            ) : (
              <Button type="primary" onClick={handleWizardCreate} loading={saving}>
                Crear marca
              </Button>
            )}
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default AdminBrandsPanel;

