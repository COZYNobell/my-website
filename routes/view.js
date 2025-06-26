// 📄 파일명: routes/view.js
// ✅ 버전: v1
// ✅ 설명: HTML 페이지를 제공하는 라우팅 로직을 전담합니다.
// 🕒 날짜: 2025-06-25

const express = require('express');
const path = require('path');
const router = express.Router();

// 이 라우터는 server.js에서 ensureAuthenticated 미들웨어를 전달받아 사용합니다.
module.exports = function(ensureAuthenticated) {
    
    // 비로그인 사용자를 위한 페이지
    router.get('/signup', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'signup.html')));
    router.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));

    // 로그인이 필요한 페이지
    router.get('/dashboard.html', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')));
    router.get('/subscribe', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'subscribe.html')));

    // 루트 경로는 로그인 상태에 따라 다른 페이지를 보여줍니다.
    router.get('/', (req, res) => {
        if (req.session.isAuthenticated && req.session.user) {
            res.redirect('/dashboard.html');
        } else {
            res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
        }
    });

    return router;
};
