// 📄 파일명: metrics.js
// ✅ 버전: v1
// ✅ 설명: Prometheus 커스텀 메트릭의 생성 및 관리를 전담하는 모듈입니다.
// 🕒 날짜: 2025-06-24

const client = require('prom-client');

// 1. 새로운 메트릭을 등록할 '레지스트리'를 생성합니다.
const register = new client.Registry();

// 2. 기본 Node.js 메트릭(CPU, 메모리, 이벤트 루프 등)을 수집하도록 설정합니다.
// 접두사를 붙여 다른 Node.js 애플리케이션의 기본 메트릭과 구분합니다.
client.collectDefaultMetrics({ register, prefix: 'weather_app_node_' });

// 3. 우리가 설계한 커스텀 메트릭들을 생성합니다.

// 3-1. HTTP 요청 시간을 기록할 Histogram
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  // 응답 시간을 0.005초부터 10초까지 다양한 구간으로 나누어 측정합니다.
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

// 3-2. 총 회원가입 수를 기록할 Counter
const usersRegisteredCounter = new client.Counter({
  name: 'users_registered_total',
  help: 'Total number of registered users',
});

// 4. 생성한 메트릭들을 레지스트리에 등록하여 수집 대상으로 포함시킵니다.
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(usersRegisteredCounter);

// 5. 다른 파일(server.js)에서 사용할 수 있도록 필요한 변수와 함수를 export 합니다.
module.exports = {
  register,
  httpRequestDurationMicroseconds,
  usersRegisteredCounter
};
