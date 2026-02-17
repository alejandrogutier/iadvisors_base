import { useEffect, useState } from 'react';
import { Table, Typography, message as antdMessage, Button, Tag, Popconfirm, Empty } from 'antd';
import { ReloadOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';

const ReportCenter = () => {
  const { user } = useAuth();
  const { currentBrand, withBrandHeaders } = useBrand();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const formatDateTime = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const loadReports = async () => {
    if (!currentBrand?.id) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(
        '/reports',
        withBrandHeaders({
          params: {
            requesterId: user?.id
          }
        })
      );
      setReports(data.reports || []);
    } catch (error) {
      antdMessage.error('No se pudieron cargar los reportes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [currentBrand?.id]);

  const markResolved = async (reportId) => {
    setResolvingId(reportId);
    try {
      await api.patch(
        `/reports/${reportId}/resolve`,
        {
          resolvedBy: user?.id
        },
        withBrandHeaders()
      );
      antdMessage.success('Reporte marcado como resuelto');
      await loadReports();
    } catch (error) {
      antdMessage.error(error.response?.data?.error || 'No se pudo actualizar');
    } finally {
      setResolvingId(null);
    }
  };

  const removeReport = async (reportId) => {
    setDeletingId(reportId);
    try {
      await api.delete(
        `/reports/${reportId}`,
        withBrandHeaders({
          data: {
            requesterId: user?.id
          }
        })
      );
      antdMessage.success('Reporte eliminado');
      await loadReports();
    } catch (error) {
      antdMessage.error(error.response?.data?.error || 'No se pudo eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const canDeleteReport = (report) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return report.user_id === user.id;
  };

  const columns = [
    {
      title: 'Usuario',
      dataIndex: 'user_name',
      key: 'user',
      render: (_, record) => (
        <div>
          <Typography.Text strong>{record.user_name}</Typography.Text>
          <div>{record.user_email}</div>
        </div>
      )
    },
    {
      title: 'Respuesta',
      dataIndex: 'message_content',
      key: 'content',
      render: (text) => <Typography.Paragraph>{text}</Typography.Paragraph>
    },
    {
      title: 'Motivo',
      dataIndex: 'reason',
      key: 'reason',
      render: (text) => text || 'Sin comentarios'
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (_, record) => (
        <div>
          <Tag color={record.status === 'resolved' ? 'green' : 'orange'}>
            {record.status === 'resolved' ? 'Resuelto' : 'Pendiente'}
          </Tag>
          {record.status === 'resolved' && (
            <Typography.Text type="secondary">
              {record.resolved_by_name ? `Por ${record.resolved_by_name}` : 'Resuelto'}
              {record.resolved_at ? ` • ${formatDateTime(record.resolved_at)}` : ''}
            </Typography.Text>
          )}
        </div>
      )
    },
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value) => formatDateTime(value)
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          {record.status !== 'resolved' && (
            <Button
              size="small"
              icon={<CheckOutlined />}
              loading={resolvingId === record.id}
              onClick={() => markResolved(record.id)}
            >
              Resuelta
            </Button>
          )}
          {canDeleteReport(record) && (
            <Popconfirm
              title="Eliminar reporte"
              description="Esta acción no se puede deshacer"
              onConfirm={() => removeReport(record.id)}
            >
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                loading={deletingId === record.id}
              >
                Eliminar
              </Button>
            </Popconfirm>
          )}
        </div>
      )
    }
  ];

  if (!currentBrand) {
    return <Empty description="Selecciona una marca para ver los reportes" />;
  }

  return (
    <div className="reports-panel">
      <div className="panel-header">
        <Typography.Title level={4}>Respuestas reportadas</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={loadReports}>
          Actualizar
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={reports}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 5 }}
      />
    </div>
  );
};

export default ReportCenter;
