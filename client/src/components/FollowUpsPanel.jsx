import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message as antdMessage,
  Popconfirm
} from 'antd';
import dayjs from 'dayjs';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';

const { RangePicker } = DatePicker;

const platformOptions = [
  { label: 'Facebook', value: 'facebook' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'X', value: 'x' },
  { label: 'Google Maps', value: 'google_maps' },
  { label: 'Farmatodo', value: 'farmatodo' },
  { label: 'La Rebaja', value: 'la_rebaja' },
  { label: 'Doctoralia', value: 'doctoralia' },
  { label: 'Wikipedia', value: 'wikipedia' },
  { label: 'Blog', value: 'blog' },
  { label: 'Otro', value: 'other' }
];

const statusOptions = [
  { label: 'Pendiente', value: 'pending' },
  { label: 'En progreso', value: 'in_progress' },
  { label: 'En revisión', value: 'review' },
  { label: 'Terminado', value: 'completed' }
];

const statusTag = {
  pending: { color: 'orange', label: 'Pendiente' },
  in_progress: { color: 'blue', label: 'En progreso' },
  review: { color: 'gold', label: 'En revisión' },
  completed: { color: 'green', label: 'Terminado' }
};

const FollowUpsPanel = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { currentBrand, withBrandHeaders } = useBrand();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState();
  const [dateRange, setDateRange] = useState();
  const [ownerFilter, setOwnerFilter] = useState();
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const platformValue = Form.useWatch('platform', form);

  const loadEntries = async () => {
    if (!user?.id || !currentBrand?.id) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = {
        userId: user.id,
        role: user.role,
        view: isAdmin ? 'all' : undefined,
        status: filterStatus,
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
        ownerId: isAdmin ? ownerFilter : undefined
      };
      const { data } = await api.get(
        '/followups',
        withBrandHeaders({
          params
        })
      );
      setEntries(data.followups || []);
    } catch (error) {
      antdMessage.error('No se pudieron cargar los registros');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get('/admin/users', withBrandHeaders());
      setUsers(data.users || []);
    } catch (error) {
      // ignore
    }
  };

  useEffect(() => {
    loadEntries();
  }, [user?.id, user?.role, filterStatus, dateRange, ownerFilter, currentBrand?.id]);

  useEffect(() => {
    loadUsers();
  }, [isAdmin]);

  const openModal = (record) => {
    setEditing(record || null);
    if (record) {
      form.setFieldsValue({
        scheduled_at: record.scheduled_at ? dayjs(record.scheduled_at) : null,
        platform: record.platform || 'facebook',
        platform_other: record.platform_other || '',
        post_url: record.post_url || '',
        status: record.status || 'pending',
        comments: record.comments || ''
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ status: 'pending', platform: 'facebook' });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        userId: editing ? editing.user_id : user.id,
        scheduledAt: values.scheduled_at ? values.scheduled_at.toISOString() : null,
        platform: values.platform,
        platformOther: values.platform === 'other' ? values.platform_other : null,
        postUrl: values.post_url,
        status: values.status,
        comments: values.comments
      };
      if (editing) {
        await api.put(
          `/followups/${editing.id}`,
          {
            ...payload,
            requesterId: user.id,
            requesterRole: user.role
          },
          withBrandHeaders()
        );
        antdMessage.success('Registro actualizado');
      } else {
        await api.post('/followups', payload, withBrandHeaders());
        antdMessage.success('Registro creado');
      }
      setModalOpen(false);
      setEditing(null);
      loadEntries();
    } catch (error) {
      if (error?.errorFields) return;
      antdMessage.error(error.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record) => {
    try {
      await api.delete(
        `/followups/${record.id}`,
        withBrandHeaders({
          data: { requesterId: user.id, requesterRole: user.role }
        })
      );
      antdMessage.success('Registro eliminado');
      loadEntries();
    } catch (error) {
      antdMessage.error(error.response?.data?.error || 'No se pudo eliminar');
    }
  };

  const formatDate = (value, withTime = false) => {
    if (!value) return '—';
    return dayjs(value).format(withTime ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY');
  };

  const platformLabel = (entry) => {
    if (entry.platform === 'other') {
      return entry.platform_other || 'Otro';
    }
    const match = platformOptions.find((item) => item.value === entry.platform);
    return match ? match.label : '—';
  };

  const columns = (() => {
    const base = [
      {
        title: 'Fecha de registro',
        dataIndex: 'created_at',
        key: 'created_at',
        render: (value) => formatDate(value, true)
      },
      {
        title: 'Fecha publicación',
        dataIndex: 'scheduled_at',
        key: 'scheduled_at',
        render: (value) => formatDate(value, true)
      },
      {
        title: 'Plataforma',
        key: 'platform',
        render: (_, record) => platformLabel(record)
      },
      {
        title: 'URL',
        dataIndex: 'post_url',
        key: 'post_url',
        render: (value) =>
          value ? (
            <a href={value} target="_blank" rel="noreferrer">
              Abrir enlace
            </a>
          ) : (
            '—'
          )
      },
      {
        title: 'Estado',
        dataIndex: 'status',
        key: 'status',
        render: (value) => {
          const meta = statusTag[value] || statusTag.pending;
          return <Tag color={meta.color}>{meta.label}</Tag>;
        }
      },
      {
        title: 'Comentarios',
        dataIndex: 'comments',
        key: 'comments',
        ellipsis: true
      }
    ];

    if (isAdmin) {
      base.splice(2, 0, {
        title: 'Usuario',
        dataIndex: 'user',
        key: 'user',
        render: (_, record) => (
          <div>
            <Typography.Text strong>{record.user?.name}</Typography.Text>
            <div>{record.user?.email}</div>
          </div>
        )
      });
    }

    base.push({
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openModal(record)}>
            Editar
          </Button>
          <Popconfirm title="¿Eliminar registro?" onConfirm={() => handleDelete(record)}>
            <Button size="small" danger>
              Borrar
            </Button>
          </Popconfirm>
        </Space>
      )
    });

    return base;
  })();

  const ownerOptions = useMemo(
    () => users.map((item) => ({ label: item.name, value: item.id })),
    [users]
  );

  if (!currentBrand) {
    return (
      <div className="followups-panel">
        <Card>
          <Typography.Text type="secondary">Selecciona una marca para gestionar los seguimientos.</Typography.Text>
        </Card>
      </div>
    );
  }

  return (
    <div className="followups-panel">
      <Card>
        <div className="panel-header">
          <div>
            <Typography.Title level={4} style={{ marginBottom: 0 }}>
              Seguimiento de publicaciones
            </Typography.Title>
            <Typography.Text type="secondary">
              Controla los mensajes que llevaste a tus plataformas
            </Typography.Text>
          </div>
          <Button type="primary" onClick={() => openModal(null)}>
            Nuevo registro
          </Button>
        </div>

        <div className="followups-filters">
          <Space size="middle" wrap>
            <Select
              allowClear
              placeholder="Estado"
              style={{ width: 180 }}
              value={filterStatus}
              onChange={(value) => setFilterStatus(value)}
              options={statusOptions}
            />
            <RangePicker value={dateRange} onChange={setDateRange} />
            {isAdmin && (
              <Select
                allowClear
                placeholder="Usuario"
                style={{ width: 220 }}
                value={ownerFilter}
                onChange={setOwnerFilter}
                options={ownerOptions}
              />
            )}
            <Button onClick={loadEntries}>Aplicar</Button>
            <Button
              onClick={() => {
                setFilterStatus(undefined);
                setDateRange(undefined);
                setOwnerFilter(undefined);
              }}
            >
              Limpiar
            </Button>
          </Space>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={entries}
          columns={columns}
          pagination={{ pageSize: 8 }}
        />
      </Card>

      <Modal
        title={editing ? 'Editar seguimiento' : 'Nuevo seguimiento'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onOk={handleSubmit}
        confirmLoading={saving}
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="Fecha de publicación" name="scheduled_at">
            <DatePicker showTime style={{ width: '100%' }} placeholder="Selecciona fecha y hora" />
          </Form.Item>
          <Form.Item label="Plataforma" name="platform" rules={[{ required: true, message: 'Selecciona una plataforma' }]}> 
            <Select options={platformOptions} placeholder="Plataforma" />
          </Form.Item>
          {platformValue === 'other' && (
            <Form.Item label="Nombre de la plataforma" name="platform_other" rules={[{ required: true, message: 'Ingresa la plataforma' }]}> 
              <Input placeholder="Nombre de la plataforma" />
            </Form.Item>
          )}
          <Form.Item
            label="URL"
            name="post_url"
            rules={[{ type: 'url', message: 'Ingresa una URL válida', warningOnly: true }]}
          >
            <Input placeholder="https://" />
          </Form.Item>
          <Form.Item label="Estado" name="status" rules={[{ required: true, message: 'Selecciona un estado' }]}> 
            <Select options={statusOptions} />
          </Form.Item>
          <Form.Item label="Comentarios" name="comments">
            <Input.TextArea rows={4} placeholder="Notas adicionales" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FollowUpsPanel;
