import { ConfigProvider } from 'antd';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {}
});

const baseTokens = {
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  borderRadius: 10,
  controlHeight: 44
};

const lightTokens = {
  ...baseTokens,
  colorPrimary: '#00a4e4',
  colorBgLayout: '#f4f7fb',
  colorBgContainer: '#ffffff',
  colorTextBase: '#0d1b2a'
};

const darkTokens = {
  ...baseTokens,
  colorPrimary: '#4dd0ff',
  colorBgLayout: '#03080f',
  colorBgContainer: '#0d1b2a',
  colorTextBase: '#f0f6fb'
};

const getPreferredTheme = () => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('iad_theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getPreferredTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('iad_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const token = useMemo(() => (theme === 'dark' ? darkTokens : lightTokens), [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <ConfigProvider
        theme={{
          token,
          components: {
            Layout: {
              headerBg: 'transparent'
            },
            Button: {
              colorBgTextHover: 'rgba(0, 164, 228, 0.15)',
              colorText: theme === 'dark' ? '#f0f6fb' : '#0d1b2a'
            }
          }
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
