import { useEffect, useState } from 'react';
import {
  Table,
  Typography,
  Button,
  Tag,
  message as antdMessage,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';

const roleOptions = [
  { label: 'Administrador', value: 'admin' },
  { label: 'Usuario', value: 'user' }
];

const AdminUsersPanel = () => {
  const { user } = useAuth();
  const { currentBrand, withBrandHeaders } = useBrand();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [form] = Form.useForm();
  const [messagesModalOpen, setMessagesModalOpen] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandTarget, setBrandTarget] = useState(null);
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandForm] = Form.useForm();
  const [brandOptions, setBrandOptions] = useState([]);

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const loadUsers = async () => {
    if (!currentBrand?.id) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users', withBrandHeaders());
      setUsers(data.users || []);
    } catch (error) {
      antdMessage.error('No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const loadBrands = async () => {
    try {
      const { data } = await api.get('/brands');
      setBrandOptions(data.brands || []);
    } catch (error) {
      // ignore
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentBrand?.id]);

  useEffect(() => {
    loadBrands();
  }, []);

  const openCreateModal = () => {
    form.resetFields();
    setModalOpen(true);
  };

  const handleViewMessages = async (userRecord) => {
    setSelectedUser(userRecord);
    setMessagesModalOpen(true);
    setMessagesLoading(true);
    try {
      const { data } = await api.get(
        `/admin/users/${userRecord.id}/messages`,
        withBrandHeaders()
      );
      setMessages(data.messages || []);
    } catch (error) {
      antdMessage.error('No se pudieron cargar los mensajes');
    } finally {
      setMessagesLoading(false);
    }
  };

  const openBrandModal = (record) => {
    setBrandTarget(record);
    brandForm.setFieldsValue({
      brands: record.brands?.map((brand) => brand.id) || [],
      defaultBrand: record.brands?.find((brand) => brand.isDefault)?.id || null
    });
    setBrandModalOpen(true);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      await api.post(
        '/admin/users',
        {
          ...values,
          brandIds: values.brands,
          defaultBrandId: values.defaultBrand
        },
        withBrandHeaders()
      );
      antdMessage.success('Usuario creado correctamente');
      setModalOpen(false);
      form.resetFields();
      await loadUsers();
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      if (error.response?.data?.error) {
        antdMessage.error(error.response.data.error);
      } else {
        antdMessage.error('No se pudo crear el usuario');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    setRoleUpdatingId(userId);
    try {
      await api.patch(`/admin/users/${userId}/role`, { role }, withBrandHeaders());
      antdMessage.success('Rol actualizado');
      await loadUsers();
    } catch (error) {
      antdMessage.error(error.response?.data?.error || 'No se pudo actualizar el rol');
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const handleDelete = async (userId) => {
    setDeletingId(userId);
    try {
      await api.delete(`/admin/users/${userId}`, withBrandHeaders());
      antdMessage.success('Usuario eliminado');
      await loadUsers();
    } catch (error) {
      antdMessage.error(error.response?.data?.error || 'No se pudo eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBrandSave = async () => {
    try {
      const values = await brandForm.validateFields();
      setBrandSaving(true);
      await api.patch(
        `/admin/users/${brandTarget.id}/brands`,
        {
          brandIds: values.brands || [],
          defaultBrandId: values.defaultBrand || null
        },
        withBrandHeaders()
      );
      antdMessage.success('Marcas actualizadas');
      setBrandModalOpen(false);
      setBrandTarget(null);
      brandForm.resetFields();
      loadUsers();
    } catch (error) {
      if (error?.errorFields) return;
      antdMessage.error(error.response?.data?.error || 'No se pudo actualizar');
    } finally {
      setBrandSaving(false);
    }
  };

  const columns = [
    {
      title: 'Usuario',
      key: 'user',
      render: (_, record) => (
        <div>
          <Typography.Text strong>{record.name}</Typography.Text>
          <div>{record.email}</div>
        </div>
      )
    },
    {
      title: 'Rol',
      dataIndex: 'role',
      key: 'role',
      render: (_, record) => (
        <Select
          size="small"
          value={record.role}
          options={roleOptions}
          onChange={(value) => handleRoleChange(record.id, value)}
          loading={roleUpdatingId === record.id}
          disabled={roleUpdatingId === record.id}
          style={{ width: 160 }}
        />
      )
    },
    {
      title: 'Marcas',
      key: 'brands',
      render: (_, record) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(record.brands || []).map((brand) => (
            <Tag key={brand.id} color={brand.isDefault ? 'blue' : 'default'}>
              {brand.name}
            </Tag>
          ))}
          {!record.brands?.length && <Tag color="default">Sin acceso</Tag>}
        </div>
      )
    },
    {
      title: 'Chats',
      dataIndex: 'total_threads',
      key: 'threads'
    },
    {
      title: 'Mensajes',
      dataIndex: 'total_messages',
      key: 'messages'
    },
    {
      title: 'Creado',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value) => formatDate(value)
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" onClick={() => handleViewMessages(record)}>
            Ver mensajes
          </Button>
          <Button size="small" onClick={() => openBrandModal(record)}>
            Marcas
          </Button>
          <Popconfirm
            title="Eliminar usuario"
            description="Esto eliminará todos sus hilos y mensajes"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              danger
              size="small"
              loading={deletingId === record.id}
              disabled={user?.id === record.id}
            >
              Eliminar
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ];

  const messageColumns = [
    {
      title: 'Rol',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={role === 'assistant' ? 'geekblue' : 'green'}>
          {role === 'assistant' ? 'Asistente' : 'Usuario'}
        </Tag>
      )
    },
    {
      title: 'Mensaje',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text) => <Typography.Paragraph ellipsis={{ rows: 2 }}>{text}</Typography.Paragraph>
    },
    {
      title: 'Conversación',
      dataIndex: 'thread_title',
      key: 'thread_title',
      render: (value) => value || 'Sin título'
    },
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value) => formatDate(value)
    }
  ];

  if (!currentBrand) {
    return (
      <div className="admin-users-panel">
        <Typography.Text type="secondary">Selecciona una marca para administrar usuarios.</Typography.Text>
      </div>
    );
  }

  return (
    <div className="admin-users-panel">
      <div className="panel-header">
        <div>
          <Typography.Title level={4} style={{ marginBottom: 0 }}>
            Administración de usuarios
          </Typography.Title>
          <Typography.Text type="secondary">
            Controla el acceso, crea cuentas y revisa la actividad
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          Nuevo usuario
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 8 }}
      />

      <Modal
        title="Crear usuario"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        confirmLoading={creating}
      >
        <Form layout="vertical" form={form} initialValues={{ role: 'user' }}>
          <Form.Item
            label="Nombre"
            name="name"
            rules={[{ required: true, message: 'Ingresa el nombre' }]}
          >
            <Input placeholder="Nombre completo" />
          </Form.Item>
          <Form.Item
            label="Correo corporativo"
            name="email"
            rules={[{ required: true, type: 'email', message: 'Correo válido requerido' }]}
          >
            <Input placeholder="usuario@empresa.com" />
          </Form.Item>
          <Form.Item
            label="Contraseña temporal"
            name="password"
            rules={[{ required: true, min: 6, message: 'Mínimo 6 caracteres' }]}
          >
            <Input.Password placeholder="••••••" />
          </Form.Item>
          <Form.Item label="Rol" name="role">
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item
            label="Marcas habilitadas"
            name="brands"
            rules={[{ required: true, message: 'Selecciona al menos una marca' }]}
          >
            <Select
              mode="multiple"
              placeholder="Selecciona las marcas"
              options={brandOptions.map((brand) => ({ label: brand.name, value: brand.id }))}
            />
          </Form.Item>
          <Form.Item
            label="Marca predeterminada"
            name="defaultBrand"
            dependencies={['brands']}
            rules={[({ getFieldValue }) => ({
              validator(_, value) {
                const selected = getFieldValue('brands') || [];
                if (!value || selected.includes(value)) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('Debe pertenecer a las marcas habilitadas'));
              }
            })]}
          >
            <Select
              allowClear
              placeholder="Selecciona la marca principal"
              options={brandOptions.map((brand) => ({ label: brand.name, value: brand.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedUser ? `Historial de mensajes – ${selectedUser.name}` : 'Historial de mensajes'}
        open={messagesModalOpen}
        onCancel={() => {
          setMessagesModalOpen(false);
          setSelectedUser(null);
        }}
        footer={null}
        width={900}
      >
        <Table
          dataSource={messages}
          rowKey="id"
          loading={messagesLoading}
          pagination={{ pageSize: 8 }}
          columns={messageColumns}
        />
      </Modal>

      <Modal
        title={brandTarget ? `Acceso a marcas – ${brandTarget.name}` : 'Acceso a marcas'}
        open={brandModalOpen}
        onCancel={() => {
          setBrandModalOpen(false);
          setBrandTarget(null);
        }}
        onOk={handleBrandSave}
        confirmLoading={brandSaving}
      >
        <Form layout="vertical" form={brandForm}>
          <Form.Item label="Marcas habilitadas" name="brands">
            <Select
              mode="multiple"
              placeholder="Selecciona las marcas disponibles"
              options={brandOptions.map((brand) => ({ label: brand.name, value: brand.id }))}
            />
          </Form.Item>
          <Form.Item
            label="Marca predeterminada"
            name="defaultBrand"
            dependencies={['brands']}
            rules={[({ getFieldValue }) => ({
              validator(_, value) {
                const selected = getFieldValue('brands') || [];
                if (!value || selected.includes(value)) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('Debe pertenecer a las marcas habilitadas'));
              }
            })]}
          >
            <Select
              allowClear
              placeholder="Selecciona la marca predeterminada"
              options={brandOptions.map((brand) => ({ label: brand.name, value: brand.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminUsersPanel;
