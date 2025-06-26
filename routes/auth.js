// 📄 파일명: routes/auth.js
// ✅ 버전: v1
// ✅ 설명: 회원가입, 로그인, 로그아웃 등 인증 관련 라우팅 로직을 전담합니다.
// 🕒 날짜: 2025-06-25

const express = require('express');
const bcrypt = require('bcrypt');
const { SNSClient, SubscribeCommand } = require("@aws-sdk/client-sns");
const { usersRegisteredCounter } = require('../metrics'); // 메트릭 모듈에서 카운터 가져오기

const router = express.Router();
const snsClient = new SNSClient({ region: process.env.AWS_REGION || "ap-northeast-2" });

// 이 라우터는 server.js에서 dbPool을 전달받아 사용합니다.
module.exports = function(dbPool) {

    // --- 회원가입 API 라우트 ---
    router.post('/signup', async (req, res) => {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.redirect(`/signup.html?error=${encodeURIComponent('이메일과 비밀번호를 모두 입력해주세요.')}`);
        }
        
        let connection;
        try {
            connection = await dbPool.getConnection();
            await connection.query(`USE \`${process.env.DB_NAME}\``);
            const [existingUsers] = await connection.query("SELECT id FROM users WHERE email = ?", [email]);
            
            if (existingUsers.length > 0) {
                return res.redirect(`/signup.html?error=${encodeURIComponent('이미 가입된 이메일입니다.')}`);
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            await connection.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashedPassword]);
            
            // 메트릭 카운터 증가
            usersRegisteredCounter.inc(); 
            
            console.log(`새 사용자 가입됨: ${email}`);

            if (process.env.SNS_TOPIC_ARN) {
                const snsParams = { Protocol: "email", TopicArn: process.env.SNS_TOPIC_ARN, Endpoint: email };
                await snsClient.send(new SubscribeCommand(snsParams));
                console.log("📧 SNS 구독 요청 완료:", email);
            }
            res.redirect(`/login.html?signup=success&email=${encodeURIComponent(email)}`);
        } catch (error) {
            console.error("회원가입 오류:", error.message, error.stack);
            res.redirect(`/signup.html?error=${encodeURIComponent('서버 오류가 발생했습니다.')}`);
        } finally {
            if (connection) connection.release();
        }
    });

    // --- 로그인 API 라우트 ---
    router.post('/login', async (req, res) => {
        const { email, password } = req.body;
        if (!email || !password) return res.redirect(`/login.html?error=${encodeURIComponent('이메일과 비밀번호를 모두 입력해주세요.')}`);
        let connection;
        try {
            connection = await dbPool.getConnection();
            await connection.query(`USE \`${process.env.DB_NAME}\``);
            const [users] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
            if (users.length === 0) return res.redirect(`/login.html?error=${encodeURIComponent('이메일 또는 비밀번호가 일치하지 않습니다.')}`);
            
            const user = users[0];
            const isMatch = await bcrypt.compare(password, user.password);
            
            if (isMatch) {
                req.session.user = { id: user.id, email: user.email };
                req.session.isAuthenticated = true;
                console.log('사용자 로그인 성공:', req.session.user);
                res.redirect('/dashboard.html');
            } else {
                return res.redirect(`/login.html?error=${encodeURIComponent('이메일 또는 비밀번호가 일치하지 않습니다.')}`);
            }
        } catch (error) {
            console.error("로그인 오류:", error.message, error.stack);
            res.redirect(`/login.html?error=${encodeURIComponent('서버 오류가 발생했습니다.')}`);
        } finally {
            if (connection) connection.release();
        }
    });

    // --- 로그아웃 라우트 ---
    router.get('/logout', (req, res) => {
        if (req.session.user) {
            const userEmail = req.session.user.email;
            req.session.destroy(err => {
                if (err) console.error('세션 파기 오류:', err);
                console.log(`사용자 (${userEmail}) 로그아웃 성공`);
                res.redirect('/?logout=success');
            });
        } else {
            res.redirect('/');
        }
    });

    return router;
};
