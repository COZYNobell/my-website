// 📄 파일명: metrics.js
// ✅ 버전: v2
// ✅ 설명: Prometheus 커스텀 메트릭 (요청 수, 요청 시간, 회원가입 수 포함)
// 🕒 날짜: 2025-06-25

const client = require('prom-client');
const register = new client.Registry();

// 기본 Node.js 성능 지표 수집 (prefix로 구분)
client.collectDefaultMetrics({ register, prefix: 'weather_app_node_' });

/**
 * 1. 요청 처리 시간 (Histogram)
 */
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

/**
 * 2. 총 HTTP 요청 수 (Counter)
 */
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

/**
 * 3. 회원가입 수 (Counter)
 */
const usersRegisteredCounter = new client.Counter({
  name: 'users_registered_total',
  help: 'Total number of registered users',
});

// 등록
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestCounter);
register.registerMetric(usersRegisteredCounter);

module.exports = {
  register,
  httpRequestDurationMicroseconds,
  httpRequestCounter,
  usersRegisteredCounter,
};
