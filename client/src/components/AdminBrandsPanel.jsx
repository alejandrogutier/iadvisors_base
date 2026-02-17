import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Select, Space, Typography, message as antdMessage } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';

const { Title, Text } = Typography;

const AdminBrandsPanel = () => {
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadBrands = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/brands');
      const brandList = data.brands || [];
      setBrands(brandList);
      if (!selectedBrandId && brandList.length) {
        setSelectedBrandId(brandList[0].id);
      }
    } catch (error) {
      antdMessage.error('No se pudieron cargar las marcas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      assistantId: brand.assistantId,
      vectorStoreId: brand.vectorStoreId,
      measurementModel: brand.measurement?.model,
      measurementSampleSize: brand.measurement?.sampleSize,
      measurementCron: brand.measurement?.cron,
      prompts: brand.measurement?.prompts || []
    });
  }, [selectedBrandId, brands, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        name: values.name,
        slug: values.slug,
        description: values.description,
        assistantId: values.assistantId,
        vectorStoreId: values.vectorStoreId,
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

  const brandOptions = useMemo(
    () => brands.map((brand) => ({ label: brand.name, value: brand.id })),
    [brands]
  );

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
            <Text type="secondary">Administra las credenciales y parámetros por marca.</Text>
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
          <Form.Item label="Assistant ID" name="assistantId" rules={[{ required: true, message: 'Assistant ID requerido' }]}> 
            <Input placeholder="asst_..." />
          </Form.Item>
          <Form.Item label="Vector Store ID" name="vectorStoreId" rules={[{ required: true, message: 'Vector Store ID requerido' }]}> 
            <Input placeholder="vs_..." />
          </Form.Item>
          <Form.Item label="Modelo de medición" name="measurementModel">
            <Input placeholder="gpt-4o-mini" />
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
