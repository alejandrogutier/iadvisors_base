import { useEffect, useState } from 'react';
import { Typography, Button, message as antdMessage, Empty, Spin } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import ChatPanel from '../components/ChatPanel';
import api from '../api';
import { useBrand } from '../context/BrandContext';

const ChatPage = () => {
  const { user } = useAuth();
  const { currentBrand, withBrandHeaders } = useBrand();
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [activeThread, setActiveThread] = useState(null);

  const loadThreads = async () => {
    if (!user || !currentBrand?.id) return;
    setLoadingThreads(true);
    try {
      const { data } = await api.get(`/chat/${user.id}/threads`, withBrandHeaders());
      setThreads(data.threads || []);
      if (!activeThread && data.threads?.length) {
        setActiveThread(data.threads[0]);
      } else if (activeThread) {
        const updated = data.threads.find((t) => t.id === activeThread.id);
        if (updated) {
          setActiveThread(updated);
        }
      }
    } catch (error) {
      antdMessage.error('No se pudo cargar las conversaciones');
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    if (!currentBrand?.id) {
      setThreads([]);
      setActiveThread(null);
      setLoadingThreads(false);
      return;
    }
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentBrand?.id]);

  const handleNewThread = async () => {
    if (!currentBrand?.id) return;
    try {
      const { data } = await api.post(
        '/chat/thread',
        {
          userId: user.id,
          title: `Conversación ${threads.length + 1}`
        },
        withBrandHeaders()
      );
      setThreads((prev) => [data.thread, ...prev]);
      setActiveThread(data.thread);
    } catch (error) {
      antdMessage.error('No se pudo crear un nuevo chat');
    }
  };

  const formatThreadSubtitle = (thread) => {
    const date = new Date(thread.last_message_at || thread.created_at);
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (!currentBrand) {
    return (
      <div className="chat-page-layout">
        <Empty description="Selecciona una marca para comenzar" style={{ margin: 'auto' }} />
      </div>
    );
  }

  return (
    <div className="chat-page-layout">
      <aside className="chat-thread-sidebar">
          <div className="chat-thread-sidebar__header">
            <Typography.Title level={5}>Conversaciones</Typography.Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              block
              onClick={handleNewThread}
              style={{ marginTop: 8 }}
            >
              Nuevo chat
            </Button>
          </div>
          <div className="chat-thread-sidebar__body">
            {loadingThreads ? (
              <div className="chat-thread-sidebar__loader">
                <Spin />
              </div>
            ) : threads.length ? (
              <div className="chat-thread-list">
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    className={`chat-thread-item ${
                      activeThread?.id === thread.id ? 'chat-thread-item--active' : ''
                    }`}
                    onClick={() => setActiveThread(thread)}
                  >
                    <Typography.Text strong className="chat-thread-item__title">
                      {thread.title || 'Sin título'}
                    </Typography.Text>
                    <Typography.Text type="secondary" className="chat-thread-item__date">
                      {formatThreadSubtitle(thread)}
                    </Typography.Text>
                  </div>
                ))}
              </div>
            ) : (
              <div className="chat-thread-list chat-thread-list--empty">
                <Empty description="Sin conversaciones" />
              </div>
            )}
          </div>
        </aside>
        <section className="chat-conversation">
          {activeThread ? (
            <>
              <div className="chat-conversation__header">
                <Typography.Title
                  level={4}
                  editable={{
                    onChange: async (value) => {
                      const trimmed = value?.trim() || 'Sin título';
                      try {
                        const { data } = await api.put(
                          `/chat/thread/${activeThread.id}`,
                          {
                            userId: user.id,
                            title: trimmed
                          },
                          withBrandHeaders()
                        );
                        setActiveThread(data.thread);
                        setThreads((prev) =>
                          prev.map((thread) => (thread.id === data.thread.id ? data.thread : thread))
                        );
                        antdMessage.success('Nombre actualizado');
                      } catch (error) {
                        antdMessage.error('No se pudo renombrar el chat');
                      }
                    },
                    tooltip: 'Renombrar chat'
                  }}
                >
                  {activeThread.title || 'Sin título'}
                </Typography.Title>
              </div>
              <ChatPanel
                user={user}
                thread={activeThread}
                onThreadUpdated={loadThreads}
                key={`${activeThread.id}-${currentBrand.id}`}
              />
            </>
          ) : (
            <Empty description="Selecciona o crea un chat para empezar" />
          )}
        </section>
    </div>
  );
};

export default ChatPage;
