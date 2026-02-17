import { useEffect, useState } from 'react';
import {
  Upload,
  Button,
  Table,
  Popconfirm,
  Typography,
  message as antdMessage
} from 'antd';
import { UploadOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../api';
import { useBrand } from '../context/BrandContext';

const FileManager = () => {
  const { currentBrand, withBrandHeaders } = useBrand();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadFiles = async () => {
    if (!currentBrand?.id) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/files', withBrandHeaders());
      setFiles(data.files || []);
    } catch {
      antdMessage.error('No se pudieron cargar los archivos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [currentBrand?.id]);

  const handleUpload = async ({ file, onSuccess, onError }) => {
    if (!currentBrand?.id) {
      onError?.(new Error('Selecciona una marca'));
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/files', formData, withBrandHeaders());
      antdMessage.success('Archivo enviado');
      onSuccess?.();
      loadFiles();
    } catch (error) {
      antdMessage.error(error.response?.data?.error || 'Error subiendo archivo');
      onError?.(error);
    }
  };

  const handleDelete = async (fileId) => {
    if (!currentBrand?.id) return;
    try {
      await api.delete(`/files/${fileId}`, withBrandHeaders());
      antdMessage.success('Archivo eliminado');
      loadFiles();
    } catch {
      antdMessage.error('No se pudo eliminar');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const columns = [
    {
      title: 'Archivo',
      dataIndex: 'id',
      key: 'id',
      render: (_, record) => record.attributes?.filename || record.id
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status'
    },
    {
      title: 'Tamaño',
      dataIndex: 'usage_bytes',
      key: 'usage_bytes',
      render: (value) => formatSize(value)
    },
    {
      title: 'Creado',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value) =>
        value ? new Date(value * 1000).toLocaleString() : 'Sin información'
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="Eliminar archivo"
          description="Esto eliminará el archivo de S3 y del índice de Knowledge Base"
          onConfirm={() => handleDelete(record.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />}>
            Eliminar
          </Button>
        </Popconfirm>
      )
    }
  ];

  if (!currentBrand) {
    return <Typography.Text type="secondary">Selecciona una marca para administrar archivos.</Typography.Text>;
  }

  return (
    <div className="vector-store-panel">
      <div className="panel-header">
        <Typography.Title level={4}>Knowledge Base</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={loadFiles}>
          Actualizar
        </Button>
      </div>
      <Typography.Paragraph>
        Sube documentos a S3 para que Bedrock Knowledge Base los procese y los use en las respuestas.
      </Typography.Paragraph>
      <Upload.Dragger
        multiple={false}
        customRequest={handleUpload}
        showUploadList={false}
        accept=".pdf,.doc,.docx,.txt,.csv"
        style={{ marginBottom: 16 }}
      >
        <p className="ant-upload-drag-icon">
          <UploadOutlined />
        </p>
        <p className="ant-upload-text">Arrastra o haz click para seleccionar</p>
        <p className="ant-upload-hint">
          Los archivos se cargan en S3 y disparan la ingesta de la KB de la marca.
        </p>
      </Upload.Dragger>
      <Table
        columns={columns}
        dataSource={files}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 5 }}
      />
    </div>
  );
};

export default FileManager;
