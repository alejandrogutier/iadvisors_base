import { Card, Typography, Form, Input, Button, message } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RegisterPage = () => {
  const { loginUser } = useAuth();
  const [loginForm] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const merkleLogo = `${import.meta.env.BASE_URL}logo_merkle.png`;

  const redirectAfterAuth = () => {
    const redirectTo = location.state?.from?.pathname || '/chat';
    navigate(redirectTo, { replace: true });
  };

  const handleLogin = async (values) => {
    try {
      await loginUser(values);
      message.success('Bienvenido de nuevo');
      redirectAfterAuth();
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Credenciales inválidas';
      message.error(errorMsg);
    }
  };
  return (
    <div className="register-page">
      <Card className="register-card">
        <div className="register-hero">
          <img src={merkleLogo} alt="Merkle" className="register-hero__logo" />
          <Typography.Title level={2} className="register-hero__title">
            iAdvisors
          </Typography.Title>
        </div>
        <Form layout="vertical" form={loginForm} onFinish={handleLogin} className="register-form">
          <Form.Item
            label="Correo"
            name="email"
            rules={[
              { required: true, message: 'Ingresa tu correo' },
              { type: 'email', message: 'Correo inválido' }
            ]}
          >
            <Input placeholder="nombre@empresa.com" />
          </Form.Item>
          <Form.Item
            label="Contraseña"
            name="password"
            rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item className="register-form__submit">
            <Button type="primary" block htmlType="submit" className="register-submit-button">
              Entrar
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterPage;
