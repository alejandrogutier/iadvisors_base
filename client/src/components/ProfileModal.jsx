import { useEffect } from 'react';
import { Modal, Tabs, Form, Input, Button, message, Typography } from 'antd';
import { useAuth } from '../context/AuthContext';

const ProfileModal = ({ open, onClose }) => {
  const { user, updateProfile, changePassword } = useAuth();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    if (open && user) {
      profileForm.setFieldsValue({
        name: user.name,
        email: user.email
      });
    }
  }, [open, user, profileForm]);

  const handleProfileSave = async (values) => {
    try {
      await updateProfile(values);
      message.success('Perfil actualizado');
      onClose();
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'No se pudo actualizar el perfil';
      message.error(errorMsg);
    }
  };

  const handlePasswordChange = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      return message.error('Las contraseñas no coinciden');
    }
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      });
      message.success('Contraseña actualizada');
      passwordForm.resetFields();
      onClose();
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'No se pudo cambiar la contraseña';
      message.error(errorMsg);
    }
  };

  const tabItems = [
    {
      key: 'profile',
      label: 'Datos básicos',
      children: (
        <Form
          layout="vertical"
          form={profileForm}
          onFinish={handleProfileSave}
          initialValues={{ name: user?.name, email: user?.email }}
        >
          <Form.Item
            label="Nombre"
            name="name"
            rules={[{ required: true, message: 'Ingresa tu nombre' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Correo"
            name="email"
            rules={[
              { required: true, message: 'Ingresa tu correo' },
              { type: 'email', message: 'Correo inválido' }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Guardar cambios
            </Button>
          </Form.Item>
        </Form>
      )
    },
    {
      key: 'password',
      label: 'Cambiar contraseña',
      children: (
        <Form layout="vertical" form={passwordForm} onFinish={handlePasswordChange}>
          <Form.Item
            label="Contraseña actual"
            name="currentPassword"
            rules={[{ required: true, message: 'Ingresa tu contraseña actual' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="Nueva contraseña"
            name="newPassword"
            rules={[
              { required: true, message: 'Ingresa una nueva contraseña' },
              { min: 6, message: 'Mínimo 6 caracteres' }
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="Confirmar contraseña"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[{ required: true, message: 'Confirma tu nueva contraseña' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Actualizar contraseña
            </Button>
          </Form.Item>
          <Typography.Paragraph type="secondary">
            Tu contraseña se almacena encriptada mediante PBKDF2.
          </Typography.Paragraph>
        </Form>
      )
    }
  ];

  return (
    <Modal
      title="Perfil de usuario"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Tabs items={tabItems} defaultActiveKey="profile" />
    </Modal>
  );
};

export default ProfileModal;
