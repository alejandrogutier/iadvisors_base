import { useEffect, useMemo, useRef, useState } from 'react';
import { Typography, Input, Button, Select, Tag, message as antdMessage, Modal, Tooltip } from 'antd';
import { SendOutlined, WarningOutlined, PlusOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api';
import { contentFormats, socialMediaFormats } from '../data/promptOptions';
import { describeElement, getChannelDescription, getFormatDescription } from '../data/promptGuides';
import { useBrand } from '../context/BrandContext';

const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024;

const formatFileSize = (bytes) => {
  if (typeof bytes !== 'number') return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const REPORT_TYPES = [
  'Tono inadecuado',
  'Desalineación con la marca',
  'Información incorrecta',
  'Sesgo o discriminación',
  'Respuesta incompleta',
  'Otro'
];

const ChatPanel = ({ user, thread, onThreadUpdated }) => {
  const { currentBrand, withBrandHeaders } = useBrand();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const [reportCategory, setReportCategory] = useState(REPORT_TYPES[0]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [formatSelection, setFormatSelection] = useState(null);
  const [channelSelection, setChannelSelection] = useState(null);
  const [selectedElements, setSelectedElements] = useState([]);
  const [profileOptions, setProfileOptions] = useState([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [archetypeSelection, setArchetypeSelection] = useState(null);
  const [toneSelection, setToneSelection] = useState(null);
  const [selectedSubtones, setSelectedSubtones] = useState([]);
  const [imageAttachment, setImageAttachment] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadMessages = async () => {
    if (!thread || !currentBrand?.id) return;
    try {
      const { data } = await api.get(
        `/chat/thread/${thread.id}/messages`,
        withBrandHeaders({
          params: { userId: user.id }
        })
      );
      setMessages(data.messages || []);
    } catch (error) {
      antdMessage.error('No se pudieron cargar los mensajes');
    }
  };

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, currentBrand?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setChannelSelection(null);
    setSelectedElements([]);
  }, [formatSelection]);

  useEffect(() => {
    setSelectedElements([]);
  }, [channelSelection]);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        setProfileLoading(true);
        const { data } = await api.get('/chat/communication-profiles');
        setProfileOptions(data?.profiles || []);
      } catch (error) {
        antdMessage.error('No se pudieron cargar los perfiles de comunicación');
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  useEffect(() => {
    setToneSelection(null);
    setSelectedSubtones([]);
  }, [archetypeSelection]);

  useEffect(() => {
    setSelectedSubtones([]);
  }, [toneSelection]);

  const formatOptions = useMemo(() => {
    return [
      {
        label: 'Contenido',
        options: contentFormats.map((format) => ({
          label: format.name,
          value: JSON.stringify({ type: 'content', name: format.name })
        }))
      },
      {
        label: 'Social media',
        options: socialMediaFormats.map((format) => ({
          label: format.name,
          value: JSON.stringify({ type: 'social', name: format.name })
        }))
      }
    ];
  }, []);

  const selectedFormat = useMemo(() => {
    if (!formatSelection) return null;
    try {
      const parsed = JSON.parse(formatSelection);
      if (parsed.type === 'content') {
        const format = contentFormats.find((item) => item.name === parsed.name);
        if (!format) return null;
        return { type: 'content', name: format.name, elements: format.elements };
      }
      if (parsed.type === 'social') {
        const format = socialMediaFormats.find((item) => item.name === parsed.name);
        if (!format) return null;
        return { type: 'social', name: format.name, channels: format.channels };
      }
    } catch (error) {
      return null;
    }
    return null;
  }, [formatSelection]);

  const availableChannels = useMemo(() => {
    if (!selectedFormat || selectedFormat.type !== 'social') return [];
    return selectedFormat.channels.map((channel) => ({
      label: channel.name,
      value: channel.name
    }));
  }, [selectedFormat]);

  const availableElements = useMemo(() => {
    if (!selectedFormat) return [];
    if (selectedFormat.type === 'content') {
      return selectedFormat.elements;
    }
    if (selectedFormat.type === 'social') {
      const channel = selectedFormat.channels.find((item) => item.name === channelSelection);
      return channel?.elements || [];
    }
    return [];
  }, [selectedFormat, channelSelection]);

  const elementOptions = useMemo(() => {
    return availableElements.map((element) => ({ label: element, value: element }));
  }, [availableElements]);

  const archetypeOptions = useMemo(() => {
    return profileOptions.map((profile) => ({ label: profile.name, value: profile.name }));
  }, [profileOptions]);

  const selectedArchetypeProfile = useMemo(() => {
    if (!archetypeSelection) return null;
    return profileOptions.find((profile) => profile.name === archetypeSelection) || null;
  }, [archetypeSelection, profileOptions]);

  const toneOptions = useMemo(() => {
    if (!selectedArchetypeProfile) return [];
    return (selectedArchetypeProfile.tones || []).map((tone) => ({ label: tone.name, value: tone.name }));
  }, [selectedArchetypeProfile]);

  const selectedToneProfile = useMemo(() => {
    if (!selectedArchetypeProfile || !toneSelection) return null;
    return (selectedArchetypeProfile.tones || []).find((tone) => tone.name === toneSelection) || null;
  }, [selectedArchetypeProfile, toneSelection]);

  const subtoneOptions = useMemo(() => {
    if (!selectedToneProfile) return [];
    return (selectedToneProfile.subtones || []).map((subtone) => ({ label: subtone.name, value: subtone.name }));
  }, [selectedToneProfile]);

  const profileSelection = useMemo(() => {
    if (!archetypeSelection && !toneSelection && selectedSubtones.length === 0) {
      return null;
    }
    return {
      archetype: archetypeSelection,
      tone: toneSelection,
      subtones: selectedSubtones
    };
  }, [archetypeSelection, toneSelection, selectedSubtones]);

  const hasProfileSelections = Boolean(
    archetypeSelection || toneSelection || (selectedSubtones && selectedSubtones.length > 0)
  );

  const elementsForContext = useMemo(() => {
    if (selectedElements.length) {
      return selectedElements;
    }
    return availableElements;
  }, [selectedElements, availableElements]);

  const describedElements = useMemo(() => {
    return elementsForContext.map((element) => ({
      name: element,
      description: describeElement(element)
    }));
  }, [elementsForContext]);

  const formatDescription = useMemo(() => {
    if (!selectedFormat) return '';
    return getFormatDescription(selectedFormat.name);
  }, [selectedFormat]);

  const channelDescription = useMemo(() => {
    if (!channelSelection) return '';
    return getChannelDescription(channelSelection);
  }, [channelSelection]);

  const formatContext = useMemo(() => {
    if (!selectedFormat) return '';

    const headerLines = [
      `Tipo de entrega: ${selectedFormat.type === 'social' ? 'Social media' : 'Contenido web'}`,
      `Formato: ${selectedFormat.name}`
    ];

    if (formatDescription) {
      headerLines.push(`Descripción del formato: ${formatDescription}`);
    }

    if (selectedFormat.type === 'social') {
      if (channelSelection) {
        headerLines.push(`Canal prioritario: ${channelSelection}`);
        if (channelDescription) {
          headerLines.push(`Contexto del canal: ${channelDescription}`);
        }
      } else {
        headerLines.push('No hay canal definido aún. Pide confirmación antes de cerrar la propuesta.');
      }
    }

    if (describedElements.length) {
      const label = selectedElements.length ? 'Elementos seleccionados' : 'Elementos sugeridos por el formato';
      headerLines.push(`${label}:`);
      describedElements.forEach(({ name, description }) => {
        headerLines.push(`- ${name}: ${description}`);
      });
    }

    const baseGuidelines = [
      'Escribe en español neutro con tono profesional y cercano alineado a Bayer.',
      'Organiza la respuesta en secciones tituladas con el nombre de cada elemento.',
      'Entrega recomendaciones accionables, cifras o ejemplos concretos cuando sea posible.',
      'Si falta información clave, solicita los datos necesarios antes de asumir.',
      'Cierra con una llamada a la acción o próximos pasos cuando aplique.'
    ];

    if (selectedFormat.type === 'social') {
      baseGuidelines.push(
        `Adapta la extensión, recursos visuales, hashtags, menciones y CTA al formato de ${channelSelection || 'la red social seleccionada'
        }, cuidando límites de caracteres y mejores prácticas.`
      );
    }

    headerLines.push('Instrucciones de respuesta:');
    baseGuidelines.forEach((guideline, index) => {
      headerLines.push(`${index + 1}. ${guideline}`);
    });

    if (selectedFormat.type === 'social' && !channelSelection) {
      headerLines.push(
        'Antes de entregar la versión final, confirma con el usuario cuál es el canal para ajustar tono y longitud.'
      );
    }

    return `[Indicaciones de formato]\n${headerLines.join('\n')}`;
  }, [
    selectedFormat,
    channelSelection,
    selectedElements.length,
    describedElements,
    formatDescription,
    channelDescription
  ]);

  const resetFormatSelections = () => {
    setFormatSelection(null);
    setChannelSelection(null);
    setSelectedElements([]);
  };

  const resetProfileSelections = () => {
    setArchetypeSelection(null);
    setToneSelection(null);
    setSelectedSubtones([]);
  };

  const clearImageAttachment = () => {
    setImageAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      antdMessage.error('Solo se permiten archivos de imagen');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      antdMessage.error('La imagen debe pesar menos de 6 MB');
      event.target.value = '';
      return;
    }
    try {
      const preview = await readFileAsDataUrl(file);
      setImageAttachment({
        file,
        preview,
        name: file.name,
        size: file.size
      });
    } catch (error) {
      antdMessage.error('No se pudo leer la imagen');
    } finally {
      event.target.value = '';
    }
  };

  const handleSubtoneChange = (values) => {
    if (!Array.isArray(values)) {
      setSelectedSubtones([]);
      return;
    }
    if (values.length > 2) {
      antdMessage.warning('Solo puedes seleccionar hasta dos subtonos');
      setSelectedSubtones(values.slice(0, 2));
      return;
    }
    setSelectedSubtones(values);
  };

  const handleSend = async () => {
    if (!currentBrand?.id) return;
    const trimmed = input.trim();
    if (!trimmed && !imageAttachment) return;
    setLoading(true);
    try {
      const displayMetadata = {
        userInput: trimmed || null,
        format: selectedFormat?.name || null,
        channel: channelSelection || null,
        elements: selectedElements.length > 0 ? selectedElements : null,
        archetype: profileSelection?.archetype || null,
        tone: profileSelection?.tone || null,
        subtones:
          profileSelection?.subtones && profileSelection.subtones.length > 0
            ? profileSelection.subtones
            : null
      };

      if (imageAttachment) {
        displayMetadata.imagePreview = imageAttachment.preview;
        displayMetadata.imageFilename = imageAttachment.name;
        displayMetadata.imageSize = imageAttachment.size;
      }

      const formData = new FormData();
      formData.append('userId', user.id);
      if (thread?.id) {
        formData.append('threadId', thread.id);
      }
      if (trimmed) {
        formData.append('message', trimmed);
      }
      if (formatContext) {
        formData.append('formatContext', formatContext);
      }
      if (profileSelection) {
        formData.append('communicationProfile', JSON.stringify(profileSelection));
      }
      formData.append('displayMetadata', JSON.stringify(displayMetadata));
      if (imageAttachment?.file) {
        formData.append('image', imageAttachment.file);
      }

      const { data } = await api.post(
        '/chat/message',
        formData,
        withBrandHeaders()
      );
      setMessages(data.messages || []);
      setInput('');
      clearImageAttachment();
      resetFormatSelections();
      resetProfileSelections();
      onThreadUpdated?.();
    } catch (error) {
      antdMessage.error(error.response?.data?.error || 'Error enviando mensaje');
    } finally {
      setLoading(false);
    }
  };

  const handleReportClick = (message) => {
    setSelectedMessage(message);
    setReportNote('');
    setReportCategory(REPORT_TYPES[0]);
    setReporting(true);
  };

  const submitReport = async () => {
    if (!selectedMessage) return;
    try {
      const trimmedNote = reportNote.trim();
      const reason = trimmedNote ? `${reportCategory} — ${trimmedNote}` : reportCategory;
      await api.post(
        '/reports',
        {
          messageId: selectedMessage.id,
          userId: user.id,
          reason
        },
        withBrandHeaders()
      );
      antdMessage.success('Respuesta reportada');
      setReporting(false);
      setReportCategory(REPORT_TYPES[0]);
      setReportNote('');
    } catch (error) {
      antdMessage.error(error.response?.data?.error || 'No se pudo reportar');
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const renderMessageContent = (item) => {
    if (item.role === 'assistant') {
      return (
        <ReactMarkdown
          className="chat-message-markdown"
          remarkPlugins={[remarkGfm]}
          linkTarget="_blank"
        >
          {item.content || ''}
        </ReactMarkdown>
      );
    }

    // For user messages, show only the user input with tags if metadata exists
    let displayMetadata = null;
    try {
      displayMetadata = item.display_metadata ? JSON.parse(item.display_metadata) : null;
    } catch (e) {
      // If parsing fails, displayMetadata stays null
    }

    const hasTags = Boolean(
      displayMetadata &&
      (displayMetadata.format ||
        displayMetadata.channel ||
        (displayMetadata.elements && displayMetadata.elements.length > 0) ||
        displayMetadata.archetype ||
        displayMetadata.tone ||
        (displayMetadata.subtones && displayMetadata.subtones.length > 0))
    );
    const hasImageAttachment = Boolean(
      displayMetadata && (displayMetadata.imagePreview || displayMetadata.imageFilename)
    );
    const hasMetadataContent = Boolean(
      displayMetadata && (displayMetadata.userInput || hasTags || hasImageAttachment)
    );

    if (hasMetadataContent) {
      return (
        <>
          {displayMetadata.userInput && (
            <Typography.Paragraph style={{ marginBottom: 8 }}>
              {displayMetadata.userInput}
            </Typography.Paragraph>
          )}
          {hasImageAttachment && (
            <div className="chat-message-image">
              {displayMetadata.imagePreview ? (
                <img
                  src={displayMetadata.imagePreview}
                  alt={displayMetadata.imageFilename || 'Imagen adjunta'}
                />
              ) : (
                <div className="chat-message-image__placeholder">Imagen adjunta</div>
              )}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {displayMetadata.imageFilename || 'Imagen adjunta'}
                {displayMetadata.imageSize ? ` • ${formatFileSize(displayMetadata.imageSize)}` : ''}
              </Typography.Text>
            </div>
          )}
          {hasTags && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {displayMetadata.format && (
                <Tag color="magenta" style={{ margin: 0 }}>
                  {displayMetadata.format}
                </Tag>
              )}
              {displayMetadata.channel && (
                <Tag color="gold" style={{ margin: 0 }}>
                  Canal: {displayMetadata.channel}
                </Tag>
              )}
              {displayMetadata.elements &&
                displayMetadata.elements.map((element) => (
                  <Tag key={element} style={{ margin: 0 }}>
                    {element}
                  </Tag>
                ))}
              {displayMetadata.archetype && (
                <Tag color="purple" style={{ margin: 0 }}>
                  Arquetipo: {displayMetadata.archetype}
                </Tag>
              )}
              {displayMetadata.tone && (
                <Tag color="volcano" style={{ margin: 0 }}>
                  Tono: {displayMetadata.tone}
                </Tag>
              )}
              {displayMetadata.subtones &&
                displayMetadata.subtones.map((subtone) => (
                  <Tag key={subtone} color="geekblue" style={{ margin: 0 }}>
                    {subtone}
                  </Tag>
                ))}
            </div>
          )}
        </>
      );
    }

    // Fallback to showing full content if no metadata
    return (
      <Typography.Paragraph style={{ marginBottom: 4 }}>
        {item.content}
      </Typography.Paragraph>
    );
  };

  const renderTimestamp = (timestamp) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  const canSendMessage = Boolean(input.trim()) || Boolean(imageAttachment);

  return (
    <div className="chat-panel chat-panel--with-sidebar">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-messages__empty">Sin mensajes todavía</div>
        ) : (
          messages.map((item) => (
            <div key={item.id} className="chat-message-item">
              <div
                className={`chat-bubble chat-bubble--${item.role === 'user' ? 'user' : 'assistant'}`}
              >
                <Typography.Text strong>
                  {item.role === 'user' ? 'Tú' : 'IAdvisors'}
                </Typography.Text>
                {renderMessageContent(item)}
                <div className="chat-bubble__footer">
                  <Typography.Text type="secondary">
                    {renderTimestamp(item.created_at)}
                  </Typography.Text>
                  {item.role === 'assistant' && (
                    <Button
                      size="small"
                      type="link"
                      icon={<WarningOutlined />}
                      onClick={() => handleReportClick(item)}
                    >
                      Reportar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-composer">
        <div className="chat-composer__context-grid">
          <div className="chat-composer__module chat-composer__module--profile">
            <div className="chat-composer__toolbar">
              <Typography.Title level={5} className="chat-composer__title">
                Perfil de comunicación
              </Typography.Title>
              <div className="chat-composer__toolbar-actions">
                {hasProfileSelections && (
                  <Button type="link" size="small" onClick={resetProfileSelections}>
                    Limpiar
                  </Button>
                )}
              </div>
            </div>
            <div className="chat-composer__profile-controls">
              <Select
                showSearch
                allowClear
                size="small"
                placeholder="Arquetipo"
                options={archetypeOptions}
                optionFilterProp="label"
                loading={profileLoading && profileOptions.length === 0}
                value={archetypeSelection}
                onChange={(value) => setArchetypeSelection(value || null)}
              />
              <div className="chat-composer__options-row">
                <Select
                  showSearch
                  allowClear
                  size="small"
                  placeholder="Tono"
                  options={toneOptions}
                  optionFilterProp="label"
                  value={toneSelection}
                  onChange={(value) => setToneSelection(value || null)}
                  disabled={!selectedArchetypeProfile}
                />
                <Select
                  mode="multiple"
                  allowClear
                  maxTagCount={2}
                  size="small"
                  placeholder="Subtonos (máx. 2)"
                  options={subtoneOptions}
                  value={selectedSubtones}
                  onChange={handleSubtoneChange}
                  disabled={!selectedToneProfile}
                />
              </div>
            </div>
            {hasProfileSelections && (
              <div className="chat-composer__summary chat-composer__summary--profile">
                {archetypeSelection && <Tag color="purple">Arquetipo: {archetypeSelection}</Tag>}
                {toneSelection && <Tag color="volcano">Tono: {toneSelection}</Tag>}
                {selectedSubtones.map((subtone) => (
                  <Tag key={subtone} color="geekblue">
                    {subtone}
                  </Tag>
                ))}
              </div>
            )}
          </div>
          <div className="chat-composer__module chat-composer__module--formats">
            <div className="chat-composer__toolbar">
              <Typography.Title level={5} className="chat-composer__title">
                Indicaciones de contenido
              </Typography.Title>
              <div className="chat-composer__toolbar-actions">
                {(formatSelection || channelSelection || selectedElements.length > 0) && (
                  <Button type="link" size="small" onClick={resetFormatSelections}>
                    Limpiar
                  </Button>
                )}
              </div>
            </div>
            <div className="chat-composer__format-controls">
              <div className="chat-composer__options-row">
                <Select
                  showSearch
                  allowClear
                  size="small"
                  placeholder="Formato del contenido"
                  options={formatOptions}
                  optionFilterProp="label"
                  value={formatSelection}
                  onChange={(value) => setFormatSelection(value || null)}
                  style={{ minWidth: 160 }}
                />
                {selectedFormat?.type === 'social' && (
                  <Select
                    showSearch
                    allowClear
                    size="small"
                    placeholder="Canal social"
                    options={availableChannels}
                    optionFilterProp="label"
                    value={channelSelection}
                    onChange={(value) => setChannelSelection(value || null)}
                    style={{ minWidth: 140 }}
                  />
                )}
              </div>
              <Select
                mode="multiple"
                allowClear
                size="small"
                placeholder="Elementos a detallar"
                options={elementOptions}
                value={selectedElements}
                onChange={(value) => setSelectedElements(value)}
                disabled={!selectedFormat || (selectedFormat.type === 'social' && !channelSelection)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
        <form
          className="chat-composer__inner"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <div className="chat-composer__input-wrapper">
            <Input.TextArea
              placeholder="Escribe tu mensaje"
              autoSize={{ minRows: 1, maxRows: 4 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={!user || loading}
              className="chat-composer__input chat-composer__textarea"
              style={{ paddingLeft: 50 }}
            />
            <div className="chat-composer__input-overlay">
              <Tooltip title="Adjuntar imagen (PNG o JPG, máximo 6 MB)">
                <Button
                  icon={<PlusOutlined />}
                  shape="circle"
                  type="text"
                  size="small"
                  disabled={!user || loading}
                  className="chat-composer__overlay-button"
                  onClick={() => fileInputRef.current?.click()}
                />
              </Tooltip>
            </div>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleImageChange}
            />
          </div>
          <Button
            type="primary"
            icon={<SendOutlined />}
            htmlType="submit"
            loading={loading}
            disabled={!user || loading || !canSendMessage}
            className="chat-composer__button"
          />
        </form>
        {imageAttachment && (
          <div className="chat-composer__attachment-preview">
            <img src={imageAttachment.preview} alt="Vista previa de la imagen" />
            <div className="chat-composer__attachment-preview-details">
              <Typography.Text strong>{imageAttachment.name}</Typography.Text>
              <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                {formatFileSize(imageAttachment.size)}
              </Typography.Text>
              <Button type="link" size="small" onClick={clearImageAttachment}>
                Quitar
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        title="Reportar respuesta"
        open={reporting}
        centered
        onOk={submitReport}
        onCancel={() => {
          setReporting(false);
          setReportCategory(REPORT_TYPES[0]);
          setReportNote('');
        }}
        okButtonProps={{ disabled: !selectedMessage }}
        confirmLoading={false}
      >
        <Typography.Paragraph>
          Selecciona una tipología y describe brevemente el problema.
        </Typography.Paragraph>
        <Select
          value={reportCategory}
          onChange={setReportCategory}
          options={REPORT_TYPES.map((item) => ({ label: item, value: item }))}
          style={{ width: '100%', marginBottom: 12 }}
        />
        <Input.TextArea
          rows={4}
          placeholder="Describe brevemente"
          value={reportNote}
          onChange={(e) => setReportNote(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default ChatPanel;
