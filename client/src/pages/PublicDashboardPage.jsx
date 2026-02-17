import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
  message as antdMessage
} from 'antd';
import { FlagOutlined, MessageOutlined, ReloadOutlined, ThunderboltOutlined, UserOutlined } from '@ant-design/icons';
import { Line, Column, Pie } from '@ant-design/plots';
import dayjs from 'dayjs';
import api from '../api';
import './PublicDashboardPage.css';
import { useTheme } from '../context/ThemeContext';
import { useBrand } from '../context/BrandContext';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const REPORT_STATUS_LABELS = {
  open: 'Pendientes',
  resolved: 'Resueltos',
  in_review: 'En revisión',
  closed: 'Cerrados'
};

const REPORT_STATUS_COLORS = {
  open: 'orange',
  resolved: 'green',
  in_review: 'blue',
  closed: 'purple'
};

const FOLLOWUP_STATUS_LABELS = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  review: 'En revisión',
  completed: 'Terminado'
};

const FOLLOWUP_STATUS_COLORS = {
  pending: 'orange',
  in_progress: 'blue',
  review: 'gold',
  completed: 'green'
};

const numberFormatter = new Intl.NumberFormat('es-ES');

const disabledDate = (current) => current && current > dayjs().endOf('day');

const PublicDashboardPage = () => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const { currentBrand, withBrandHeaders } = useBrand();
  const axisColor = isDarkMode ? 'rgba(240, 246, 251, 0.4)' : 'rgba(13, 27, 42, 0.35)';
  const gridColor = isDarkMode ? 'rgba(240, 246, 251, 0.2)' : 'rgba(13, 27, 42, 0.12)';
  const labelColor = isDarkMode ? '#f0f6fb' : '#0d1b2a';
  const axisLabelConfig = {
    style: {
      fill: labelColor,
      fontSize: 12
    }
  };
  const axisLineConfig = { style: { stroke: axisColor } };
  const axisTickConfig = { style: { stroke: axisColor } };
  const tooltipDomStyles = {
    'g2-tooltip': {
      backgroundColor: isDarkMode ? '#0d1b2a' : '#ffffff',
      border: `1px solid ${axisColor}`,
      color: labelColor
    },
    'g2-tooltip-title': {
      color: labelColor
    },
    'g2-tooltip-list-item': {
      color: labelColor
    }
  };
  const defaultRange = useMemo(() => {
    const end = dayjs();
    return [end.subtract(29, 'day'), end];
  }, []);
  const [range, setRange] = useState(defaultRange);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchMetrics = useCallback(
    async (rangeValue) => {
      if (!currentBrand?.id) {
        setMetrics(null);
        setLoading(false);
        return;
      }
      if (!Array.isArray(rangeValue) || !rangeValue[0] || !rangeValue[1]) {
        return;
      }
      setLoading(true);
      try {
        const params = {
          startDate: rangeValue[0].format('YYYY-MM-DD'),
          endDate: rangeValue[1].format('YYYY-MM-DD')
        };
        const { data } = await api.get('/public-dashboard', withBrandHeaders({ params }));
        setMetrics(data);
        setLastUpdated(dayjs());
      } catch (error) {
        const message = error.response?.data?.error || 'No se pudo cargar el dashboard';
        antdMessage.error(message);
      } finally {
        setLoading(false);
      }
    },
    [currentBrand?.id]
  );

  useEffect(() => {
    fetchMetrics(defaultRange);
  }, [defaultRange, fetchMetrics]);

  const handleRangeChange = (values) => {
    if (!values || !values[0] || !values[1]) return;
    setRange(values);
    fetchMetrics(values);
  };

  const handleRefresh = () => {
    fetchMetrics(range);
  };

  const totalReports = useMemo(
    () => (metrics?.reportStatusTotals || []).reduce((acc, item) => acc + item.total, 0),
    [metrics]
  );

  const timelineSeries = useMemo(() => {
    if (!metrics?.timeline?.length) return [];
    return metrics.timeline.flatMap((item) => [
      {
        date: item.date,
        category: 'Mensajes de usuarios',
        value: item.userMessages || 0
      },
      {
        date: item.date,
        category: 'Mensajes del asistente',
        value: item.assistantMessages || 0
      },
      {
        date: item.date,
        category: 'Seguimientos',
        value: item.followups || 0
      },
      {
        date: item.date,
        category: 'Reportes',
        value: item.reports || 0
      }
    ]);
  }, [metrics]);

  const messageLeaderboardData = metrics?.messageLeaderboard?.map((item) => ({
    name: item.name || item.email || 'Sin nombre',
    value: item.total
  })) || [];

  const followupLeaderboardData = metrics?.followupLeaderboard?.map((item) => ({
    name: item.name || item.email || 'Sin nombre',
    value: item.total
  })) || [];

  const reportPieData = (metrics?.reportStatusTotals || []).map((item) => ({
    type: REPORT_STATUS_LABELS[item.status] || item.status || 'Otro',
    value: item.total,
    rawStatus: item.status
  }));

  const followupStatusTags = metrics?.followUpTotals?.byStatus || [];

  const formatNumber = (value) => numberFormatter.format(value || 0);

  const rangeDescription = useMemo(() => {
    if (!metrics?.range) return '';
    const start = dayjs(metrics.range.startDate).format('DD MMM YYYY');
    const end = dayjs(metrics.range.endDate).format('DD MMM YYYY');
    return `${start} — ${end}`;
  }, [metrics]);

  if (!currentBrand) {
    return (
      <div className="public-dashboard">
        <Card>
          <Text type="secondary">Selecciona una marca para visualizar el dashboard.</Text>
        </Card>
      </div>
    );
  }

  return (
    <div className="public-dashboard">
      <div className="public-dashboard__inner">
        <section className="public-dashboard__hero">
          <div className="public-dashboard__hero-text">
            <Title level={2}>Inteligencia abierta para iAdvisors</Title>
            <Paragraph>
              Monitorea la adopción, reportes y seguimiento de la plataforma en tiempo real. Este tablero público se
              actualiza automáticamente y resume el pulso de la operación.
            </Paragraph>
            <div className="public-dashboard__hero-actions">
              <RangePicker
                allowClear={false}
                value={range}
                onChange={handleRangeChange}
                disabledDate={disabledDate}
                format="DD MMM YYYY"
              />
              <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                Actualizar
              </Button>
            </div>
            <div className="public-dashboard__hero-meta">
              <span className="public-dashboard__meta-chip">
                Rango activo: {rangeDescription || 'Selecciona un rango para empezar'}
              </span>
              {lastUpdated && (
                <span className="public-dashboard__meta-chip public-dashboard__meta-chip--muted">
                  Actualizado {lastUpdated.format('DD MMM YYYY HH:mm')}
                </span>
              )}
            </div>
          </div>
          <div className="public-dashboard__hero-highlight">
            <span>Usuarios activos</span>
            <strong>{formatNumber(metrics?.activeUsers || 0)}</strong>
            <Text type="secondary">Personas que escribieron en el rango seleccionado</Text>
          </div>
        </section>

        <Spin spinning={loading} size="large">
          <div className="public-dashboard__content">
            <div className="public-dashboard__stats-grid">
              <Card className="public-dashboard__stats-card" bordered={false}>
                <div className="public-dashboard__stats-card-icon" style={{ background: 'rgba(0, 164, 228, 0.12)' }}>
                  <UserOutlined />
                </div>
                <Statistic title="Usuarios activos" value={formatNumber(metrics?.activeUsers || 0)} />
                <Text type="secondary">Colaboradores únicos enviando mensajes</Text>
              </Card>
              <Card className="public-dashboard__stats-card" bordered={false}>
                <div className="public-dashboard__stats-card-icon" style={{ background: 'rgba(13, 27, 42, 0.08)' }}>
                  <MessageOutlined />
                </div>
                <Statistic title="Mensajes" value={formatNumber(metrics?.messageTotals?.user || 0)} />
                <Space size="small" className="public-dashboard__chip-group">
                  <Tag color="blue">Asistente: {formatNumber(metrics?.messageTotals?.assistant || 0)}</Tag>
                  <Tag>Totales: {formatNumber(metrics?.messageTotals?.total || 0)}</Tag>
                </Space>
              </Card>
              <Card className="public-dashboard__stats-card" bordered={false}>
                <div className="public-dashboard__stats-card-icon" style={{ background: 'rgba(255, 154, 0, 0.15)' }}>
                  <ThunderboltOutlined />
                </div>
                <Statistic title="Seguimientos" value={formatNumber(metrics?.followUpTotals?.total || 0)} />
                <div className="public-dashboard__status-tags">
                  {followupStatusTags.length ? (
                    <Space wrap size={[8, 8]}>
                      {followupStatusTags.map((item) => (
                        <Tag key={item.status} color={FOLLOWUP_STATUS_COLORS[item.status] || 'blue'}>
                          {FOLLOWUP_STATUS_LABELS[item.status] || item.status}: {item.total}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <Text type="secondary">Sin actividades registradas</Text>
                  )}
                </div>
              </Card>
              <Card className="public-dashboard__stats-card" bordered={false}>
                <div className="public-dashboard__stats-card-icon" style={{ background: 'rgba(242, 99, 112, 0.18)' }}>
                  <FlagOutlined />
                </div>
                <Statistic title="Reportes" value={formatNumber(totalReports || 0)} />
                <div className="public-dashboard__status-tags">
                  {(metrics?.reportStatusTotals || []).length ? (
                    <Space wrap size={[8, 8]}>
                      {metrics.reportStatusTotals.map((item) => (
                        <Tag key={item.status} color={REPORT_STATUS_COLORS[item.status] || 'purple'}>
                          {REPORT_STATUS_LABELS[item.status] || item.status}: {item.total}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <Text type="secondary">Sin reportes en el rango</Text>
                  )}
                </div>
              </Card>
            </div>

            <Card className="public-dashboard__card" title="Línea de tiempo" bordered={false}>
              {timelineSeries.length ? (
                <Line
                  data={timelineSeries}
                  xField="date"
                  yField="value"
                  seriesField="category"
                  smooth
                  height={320}
                  padding="auto"
                  xAxis={{
                    label: {
                      ...axisLabelConfig,
                      formatter: (value) => dayjs(value).format('DD MMM')
                    },
                    line: axisLineConfig,
                    tickLine: axisTickConfig
                  }}
                  yAxis={{
                    label: axisLabelConfig,
                    grid: {
                      line: {
                        style: {
                          stroke: gridColor,
                          lineDash: [4, 4]
                        }
                      }
                    }
                  }}
                  tooltip={{
                    formatter: (datum) => ({
                      name: datum.category,
                      value: `${datum.value} registros`
                    }),
                    domStyles: tooltipDomStyles
                  }}
                  legend={{
                    position: 'top',
                    itemName: {
                      style: { fill: labelColor }
                    }
                  }}
                />
              ) : (
                <Empty description="Sin actividad en el rango seleccionado" />
              )}
            </Card>

            <div className="public-dashboard__split-grid">
              <Card className="public-dashboard__card" title="Reportes por estado" bordered={false}>
                {reportPieData.length ? (
                  <Pie
                    data={reportPieData}
                    angleField="value"
                    colorField="type"
                    radius={1}
                    innerRadius={0.65}
                    label={{
                      type: 'inner',
                      offset: '-50%',
                      content: ({ value }) => `${value}`,
                      style: { fill: labelColor }
                    }}
                    interactions={[{ type: 'element-active' }]}
                    legend={{
                      position: 'bottom',
                      itemName: { style: { fill: labelColor } }
                    }}
                    statistic={{
                      title: false,
                      content: {
                        style: {
                          fontSize: 28,
                          fontWeight: 600,
                          color: labelColor
                        },
                        formatter: () => `${totalReports} reportes`
                      }
                    }}
                  />
                ) : (
                  <Empty description="Sin reportes en el rango" />
                )}
              </Card>
              <Card className="public-dashboard__card" title="Actividad de seguimiento" bordered={false}>
                {followupLeaderboardData.length ? (
                  <Column
                    data={followupLeaderboardData}
                    xField="name"
                    yField="value"
                    columnWidthRatio={0.6}
                    legend={false}
                    xAxis={{
                      label: {
                        autoHide: true,
                        autoRotate: true,
                        ...axisLabelConfig
                      },
                      line: axisLineConfig,
                      tickLine: axisTickConfig
                    }}
                    yAxis={{
                      label: axisLabelConfig,
                      grid: {
                        line: {
                          style: {
                            stroke: gridColor,
                            lineDash: [4, 4]
                          }
                        }
                      }
                    }}
                    tooltip={{
                      formatter: (datum) => ({
                        name: datum.name,
                        value: `${datum.value} seguimientos`
                      }),
                      domStyles: tooltipDomStyles
                    }}
                  />
                ) : (
                  <Empty description="Sin seguimientos en el rango" />
                )}
              </Card>
            </div>

            <div className="public-dashboard__split-grid">
              <Card className="public-dashboard__card" title="Top usuarios por mensajes" bordered={false}>
                {messageLeaderboardData.length ? (
                  <Column
                    data={messageLeaderboardData}
                    xField="name"
                    yField="value"
                    columnWidthRatio={0.6}
                    legend={false}
                    xAxis={{
                      label: {
                        autoHide: true,
                        autoRotate: true,
                        ...axisLabelConfig
                      },
                      line: axisLineConfig,
                      tickLine: axisTickConfig
                    }}
                    yAxis={{
                      label: axisLabelConfig,
                      grid: {
                        line: {
                          style: {
                            stroke: gridColor,
                            lineDash: [4, 4]
                          }
                        }
                      }
                    }}
                    tooltip={{
                      formatter: (datum) => ({
                        name: datum.name,
                        value: `${datum.value} mensajes`
                      }),
                      domStyles: tooltipDomStyles
                    }}
                  />
                ) : (
                  <Empty description="Sin mensajes en el rango" />
                )}
              </Card>
              <Card className="public-dashboard__card" title="Detalle de reportes" bordered={false}>
                {(metrics?.reportStatusTotals || []).length ? (
                  <div className="public-dashboard__report-list">
                    {(metrics?.reportStatusTotals || []).map((item) => (
                      <div className="public-dashboard__report-item" key={item.status}>
                        <div>
                          <Text strong>{REPORT_STATUS_LABELS[item.status] || item.status}</Text>
                          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                            Proporción dentro del rango seleccionado
                          </Paragraph>
                        </div>
                        <Statistic value={item.total} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description="Sin datos para mostrar" />
                )}
              </Card>
            </div>
          </div>
        </Spin>
      </div>
    </div>
  );
};

export default PublicDashboardPage;
