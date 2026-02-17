import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  message as antdMessage
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Line } from '@ant-design/plots';
import dayjs from 'dayjs';
import api from '../api';
import { useBrand } from '../context/BrandContext';

const { RangePicker } = DatePicker;
const { Title, Text, Paragraph } = Typography;


const formatPercentage = (value) => `${(value * 100).toFixed(1)}%`;

const disabledDate = (current) => current && current > dayjs().endOf('day');

const RecommendationAnalyticsPanel = () => {
  const { currentBrand, withBrandHeaders } = useBrand();
  const defaultRange = useMemo(() => {
    const end = dayjs();
    const start = end.subtract(29, 'day');
    return [start, end];
  }, []);
  const [range, setRange] = useState(defaultRange);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  const fetchSummary = useCallback(async (rangeValue) => {
    if (!currentBrand?.id) {
      setSummary(null);
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
      const { data } = await api.get('/measurements/summary', withBrandHeaders({ params }));
      setSummary(data);
    } catch (error) {
      const message = error.response?.data?.error || 'No se pudo cargar la analítica';
      antdMessage.error(message);
    } finally {
      setLoading(false);
    }
  }, [currentBrand?.id]);

  useEffect(() => {
    fetchSummary(defaultRange);
  }, [defaultRange, fetchSummary]);

  const handleRangeChange = (values) => {
    if (!values || !values[0] || !values[1]) return;
    setRange(values);
    fetchSummary(values);
  };

  const handleRefresh = () => {
    fetchSummary(range);
  };

  const formatDate = (value, format = 'DD MMM YYYY') => {
    if (!value) return '—';
    const parsed = dayjs(value);
    if (!parsed.isValid()) return '—';
    return parsed.format(format);
  };

  const renderChart = (measurementSummary) => {
    if (!measurementSummary?.chartSeries?.length) {
      return <Empty description="Sin datos en el rango seleccionado" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }
    const config = {
      data: measurementSummary.chartSeries,
      xField: 'date',
      yField: 'total',
      seriesField: 'brand',
      smooth: true,
      height: 320,
      autoFit: true,
      point: {
        size: 3,
        shape: 'circle'
      },
      tooltip: {
        formatter: (datum) => ({
          name: datum.brand,
          value: `${datum.total} menciones`
        })
      },
      xAxis: {
        label: {
          formatter: (value) => dayjs(value).format('DD MMM')
        }
      },
      yAxis: {
        label: null
      },
      legend: {
        position: 'top'
      }
    };
    return <Line {...config} />;
  };

  const tableColumns = [
    {
      title: 'Marca',
      dataIndex: 'brand',
      key: 'brand',
      render: (value, _record, index) => (
        <Space>
          <Tag color={index < 5 ? 'blue' : 'default'}>#{index + 1}</Tag>
          <span>{value}</span>
        </Space>
      )
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      align: 'right'
    },
    {
      title: '% dentro del rango',
      dataIndex: 'percentage',
      key: 'percentage',
      align: 'right',
      render: (value) => formatPercentage(value || 0)
    }
  ];

  const renderMeasurementCard = (measurementType, label) => {
    const measurementSummary = summary?.summaries?.[measurementType];
    if (!measurementSummary) return null;
    const promptDetails = summary?.prompts?.find((prompt) => prompt.key === measurementType);
    const lastRun = summary?.latestRuns?.[measurementType];

    return (
      <Card key={measurementType} className="measurement-card">
        <div className="measurement-card__meta">
          <div>
            <Title level={5} style={{ marginBottom: 4 }}>
              {promptDetails?.label || label || measurementType}
            </Title>
            <Text type="secondary">Última corrida: {formatDate(lastRun?.lastCreatedAt, 'DD MMM YYYY HH:mm')}</Text>
            {promptDetails?.question && (
              <Paragraph type="secondary" className="measurement-card__question">
                {promptDetails.question}
              </Paragraph>
            )}
          </div>
          <Space size="large">
            <Statistic title="Respuestas en el rango" value={measurementSummary.totalSamples} valueStyle={{ fontSize: 20 }} />
            <Statistic
              title="Muestreos diarios"
              value={summary?.sampleSize || 0}
              suffix="por tipo"
              valueStyle={{ fontSize: 20 }}
            />
          </Space>
        </div>
        <div className={`measurement-card__content measurement-card__content--${measurementType}`}>
          <div className="measurement-card__chart">
            {renderChart(measurementSummary)}
          </div>
          <div className="measurement-card__table">
            <Table
              columns={tableColumns}
              dataSource={measurementSummary.table}
              rowKey={(record) => record.brand}
              pagination={false}
              size="small"
            />
          </div>
        </div>
      </Card>
    );
  };

  if (!currentBrand) {
    return (
      <Card>
        <Text type="secondary">Selecciona una marca para ver la analítica de recomendaciones.</Text>
      </Card>
    );
  }

  return (
    <div className="recommendation-analytics-panel">
      <div className="panel-header">
        <div>
          <Title level={4} style={{ marginBottom: 0 }}>
            Analítica de recomendaciones
          </Title>
          <Text type="secondary">
            Seguimiento diario de marcas recomendadas por el modelo en consultas de marca y síntomas
          </Text>
        </div>
        <Space>
          <RangePicker
            value={range}
            onChange={handleRangeChange}
            format="DD/MM/YYYY"
            allowClear={false}
            disabledDate={disabledDate}
          />
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} disabled={loading}>
            Actualizar
          </Button>
        </Space>
      </div>
      <Spin spinning={loading}>
        {!summary ? (
          <Card>
            <Empty description="Sin datos disponibles" />
          </Card>
        ) : (
          (summary.prompts || []).map((prompt) => renderMeasurementCard(prompt.key, prompt.label))
        )}
      </Spin>
    </div>
  );
};

export default RecommendationAnalyticsPanel;
