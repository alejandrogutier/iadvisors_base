import { useMemo, useState } from 'react';
import {
  AlertOutlined,
  ApartmentOutlined,
  BulbOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  RobotOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Layout, Menu, Select, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBrand } from '../../context/BrandContext';
import { useTheme } from '../../context/ThemeContext';
import ProfileModal from '../ProfileModal';

const { Header, Sider, Content } = Layout;

const baseMenuItems = [
  { key: '/chat', label: 'Conversaciones', icon: <MessageOutlined /> },
  { key: '/dashboard', label: 'Dashboard', icon: <DashboardOutlined /> },
  { key: '/vector-store', label: 'Vector Store', icon: <DatabaseOutlined /> },
  { key: '/reports', label: 'Reportes', icon: <AlertOutlined /> },
  { key: '/follow-ups', label: 'Seguimiento', icon: <BulbOutlined /> }
];

const adminMenuItems = [
  { key: '/admin/users', label: 'Usuarios', icon: <TeamOutlined /> },
  { key: '/admin/assistant', label: 'Asistente', icon: <RobotOutlined /> },
  { key: '/admin/brands', label: 'Marcas', icon: <ApartmentOutlined /> },
  { key: '/admin/analytics', label: 'Analitica', icon: <LineChartOutlined /> }
];

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { availableBrands, currentBrandId, setBrand } = useBrand();

  const menuItems = useMemo(() => {
    if (user?.role === 'admin') {
      return [...baseMenuItems, ...adminMenuItems];
    }
    return baseMenuItems;
  }, [user?.role]);

  const selectedMenuKey = useMemo(() => {
    const match = menuItems.find((item) => location.pathname.startsWith(item.key));
    return match?.key || '/chat';
  }, [location.pathname, menuItems]);

  const userMenu = {
    items: [
      { key: 'profile', label: 'Mi perfil', icon: <UserOutlined /> },
      { key: 'logout', label: 'Cerrar sesion', icon: <LogoutOutlined /> }
    ],
    onClick: ({ key }) => {
      if (key === 'profile') {
        setProfileOpen(true);
        return;
      }
      if (key === 'logout') {
        logout();
        navigate('/login', { replace: true });
      }
    }
  };

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="app-header__left">
          <div className="app-logo">
            <img className="app-logo__image" src="/logo_merkle.png" alt="Merkle" />
            <Typography.Title level={4} className="app-logo__text">
              iAdvisors
            </Typography.Title>
          </div>
          <div className="app-brand-switcher">
            <Select
              className="app-brand-switcher__select"
              value={currentBrandId || undefined}
              onChange={setBrand}
              placeholder="Selecciona una marca"
              options={availableBrands.map((brand) => ({ value: brand.id, label: brand.name }))}
              disabled={!availableBrands.length}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div className="app-header__actions">
          <Button
            className="theme-toggle"
            type="text"
            aria-label="Cambiar tema"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? 'Claro' : 'Oscuro'}
          </Button>
          <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
            <div className="header-user">
              <Avatar icon={<UserOutlined />} />
              <Typography.Text className="header-user__name">{user?.name || 'Usuario'}</Typography.Text>
            </div>
          </Dropdown>
        </div>
      </Header>

      <Layout className="app-main">
        <Sider
          className={`app-sider ${collapsed ? 'app-sider--collapsed' : ''}`}
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={260}
        >
          <div className="app-sider__inner">
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[selectedMenuKey]}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
            />
            <Button
              className="sider-collapse"
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((prev) => !prev)}
            >
              {collapsed ? '' : 'Colapsar'}
            </Button>
          </div>
        </Sider>
        <Content className={`app-content ${location.pathname.startsWith('/chat') ? 'app-content--chat' : ''}`}>
          <Outlet />
        </Content>
      </Layout>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </Layout>
  );
};

export default AppLayout;
