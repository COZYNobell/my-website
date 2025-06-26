// 📄 파일명: routes/auth.js
// ✅ 버전: v2 (디버깅)
// ✅ 설명: '/signup' 라우트 핸들러에 상세한 단계별 로그를 추가하여, 메트릭 카운터가 증가하지 않는 원인을 추적합니다.
// 🕒 날짜: 2025-06-25

const express = require('express');
const bcrypt = require('bcrypt');
const { SNSClient, SubscribeCommand } = require("@aws-sdk/client-sns");
const { usersRegisteredCounter } = require('../metrics');

const router = express.Router();
const snsClient = new SNSClient({ region: process.env.AWS_REGION || "ap-northeast-2" });

module.exports = function(dbPool) {

    router.post('/signup', async (req, res) => {
        console.log('--- [Debug] /signup 요청 수신 ---');
        const { email, password } = req.body;

        if (!email || !password) {
            console.log('[Debug] 오류: 이메일 또는 비밀번호 누락.');
            return res.redirect(`/signup.html?error=${encodeURIComponent('이메일과 비밀번호를 모두 입력해주세요.')}`);
        }
        
        let connection;
        try {
            console.log('[Debug] 1. DB 커넥션 가져오기 시도...');
            connection = await dbPool.getConnection();
            console.log('[Debug] 2. DB 커넥션 성공. DB 사용 설정 시도...');
            await connection.query(`USE \`${process.env.DB_NAME}\``);
            console.log(`[Debug] 3. DB '${process.env.DB_NAME}' 사용 설정 완료.`);

            console.log(`[Debug] 4. 중복 이메일 확인 쿼리 실행: ${email}`);
            const [existingUsers] = await connection.query("SELECT id FROM users WHERE email = ?", [email]);
            
            if (existingUsers.length > 0) {
                console.log('[Debug] 오류: 이미 가입된 이메일입니다.');
                return res.redirect(`/signup.html?error=${encodeURIComponent('이미 가입된 이메일입니다.')}`);
            }
            console.log('[Debug] 5. 중복 이메일 없음 확인.');

            console.log('[Debug] 6. 비밀번호 해싱 시작...');
            const hashedPassword = await bcrypt.hash(password, 10);
            console.log('[Debug] 7. 비밀번호 해싱 완료.');
            
            console.log('[Debug] 8. 사용자 정보 DB에 저장 시도...');
            await connection.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashedPassword]);
            console.log('[Debug] 9. 사용자 정보 저장 성공.');
            
            console.log('[Debug] 10. 메트릭 카운터 증가 시도...');
            usersRegisteredCounter.inc(); 
            console.log('[Debug] 11. 메트릭 카운터 증가 완료.');
            
            if (process.env.SNS_TOPIC_ARN) {
                console.log('[Debug] 12. SNS 구독 요청 시도...');
                await snsClient.send(new SubscribeCommand({ Protocol: "email", TopicArn: process.env.SNS_TOPIC_ARN, Endpoint: email }));
                console.log("📧 SNS 구독 요청 완료:", email);
            }
            
            console.log('[Debug] 13. 로그인 페이지로 리디렉션.');
            res.redirect(`/login.html?signup=success&email=${encodeURIComponent(email)}`);

        } catch (error) {
            console.error("🔴 [Debug] 회원가입 처리 중 심각한 오류 발생:", error.message, error.stack);
            res.redirect(`/signup.html?error=${encodeURIComponent('서버 오류가 발생했습니다. 로그를 확인해주세요.')}`);
        } finally {
            if (connection) {
                console.log('[Debug] 14. DB 커넥션 반환.');
                connection.release();
            }
        }
    });

    // --- 나머지 로그인, 로그아웃 라우트는 이전과 동일 ---
    router.post('/login', async (req, res) => {
        // ... (기존 로그인 로직) ...
    });

    router.get('/logout', (req, res) => {
        // ... (기존 로그아웃 로직) ...
    });

    return router;
};
