// public/js/dashboard.js

const API_URL = "https://7bsjoaagma.execute-api.ap-northeast-2.amazonaws.com/test2/api";

async function fetchWithAuth(apiUrl, options = {}) {
    const token = localStorage.getItem('token');
    options.headers = options.headers || {};
    options.headers['Content-Type'] = 'application/json';
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    console.log("📡 요청:", apiUrl);
    try {
        const response = await fetch(apiUrl, options);
        if (response.status === 401) {
            const data = await response.json();
            console.warn("🚫 401 응답:", data.message);
            logout();
            return;
        }
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`오류 ${response.status}: ${text}`);
        }
        return await response.json();
    } catch (err) {
        console.error("❌ fetch 실패:", err.message);
        throw err;
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    window.location.href = '/login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const data = await fetchWithAuth(`${API_URL}/current-user`);
        if (data && data.user) {
            const emailSpan = document.getElementById('userEmail');
            if (emailSpan) emailSpan.textContent = data.user.email;
            console.log("✅ 로그인 사용자:", data.user);
            // 추가로 즐겨찾기나 날씨 정보 불러오기 로직 연결 가능
        } else {
            console.warn("사용자 정보 없음 또는 응답 오류");
        }
    } catch (e) {
        console.warn("로그인 정보 확인 실패:", e.message);
    }

    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
});
