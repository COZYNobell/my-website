// 📄 파일명: routes/api.js
// ✅ 설명: /api/로 시작하는 모든 기능 관련 API 라우팅 로직을 전담합니다.

const express = require('express');
const axios = require('axios');
const router = express.Router();
const { usersRegisteredCounter } = require('../metrics');

// 이 라우터는 server.js에서 dbPool과 ensureAuthenticated 미들웨어를 전달받아 사용합니다.
module.exports = function(dbPool, ensureAuthenticated) {

    router.get('/current-user', ensureAuthenticated, (req, res) => res.json({ loggedIn: true, user: req.session.user }));

    router.post('/favorites', ensureAuthenticated, async (req, res) => {
        let connection;
        try {
            connection = await dbPool.getConnection();
            await connection.query(`USE \`${process.env.DB_NAME}\``);
            const { location_name, latitude, longitude } = req.body;
            const userId = req.session.user.id;
            if (!location_name || latitude === undefined || longitude === undefined) {
                return res.status(400).json({ message: '장소 이름, 위도, 경도가 모두 필요합니다.' });
            }
            const sql = `INSERT INTO favorites (user_id, location_name, latitude, longitude) VALUES (?, ?, ?, ?)`;
            const params = [userId, location_name, latitude, longitude];
            const [result] = await connection.query(sql, params);
            res.status(201).json({
                message: '즐겨찾기에 추가되었습니다.',
                favorite: { id: result.insertId, user_id: userId, location_name, latitude, longitude }
            });
            console.log(`사용자 ID ${userId}가 즐겨찾기 추가: ${location_name} (Fav ID: ${result.insertId})`);
        } catch (error) {
            console.error("즐겨찾기 추가 중 DB 오류:", error.message, error.stack);
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: '이미 즐겨찾기에 추가된 장소일 수 있습니다.' });
            }
            return res.status(500).json({ message: `즐겨찾기 추가 중 서버 오류가 발생했습니다: ${error.message}` });
        } finally {
            if (connection) connection.release();
        }
    });

    router.get('/favorites', ensureAuthenticated, async (req, res) => {
        let connection;
        try {
            connection = await dbPool.getConnection();
            await connection.query(`USE \`${process.env.DB_NAME}\``);
            const userId = req.session.user.id;
            const sql = `SELECT id, location_name, latitude, longitude, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC`;
            const [rows] = await connection.query(sql, [userId]);
            res.json(rows);
        } catch (error) {
            console.error("즐겨찾기 조회 중 DB 오류:", error.message, error.stack);
            return res.status(500).json({ message: `즐겨찾기 목록을 불러오는 중 오류가 발생했습니다: ${error.message}` });
        } finally {
            if (connection) connection.release();
        }
    });

    router.delete('/favorites/:id', ensureAuthenticated, async (req, res) => {
        let connection;
        try {
            connection = await dbPool.getConnection();
            await connection.query(`USE \`${process.env.DB_NAME}\``);
            const favoriteId = req.params.id;
            const userId = req.session.user.id;
            const sql = `DELETE FROM favorites WHERE id = ? AND user_id = ?`;
            const params = [favoriteId, userId];
            const [result] = await connection.query(sql, params);
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: '해당 즐겨찾기를 찾을 수 없거나 삭제할 권한이 없습니다.' });
            }
            res.json({ message: '즐겨찾기에서 삭제되었습니다.', favoriteId: parseInt(favoriteId) });
            console.log(`사용자 ID ${userId}가 즐겨찾기 삭제: Fav ID ${favoriteId}`);
        } catch (error) {
            console.error("즐겨찾기 삭제 중 DB 오류:", error.message, error.stack);
            return res.status(500).json({ message: `즐겨찾기 삭제 중 오류가 발생했습니다: ${error.message}` });
        } finally {
            if (connection) connection.release();
        }
    });

    router.post('/weather-subscriptions', ensureAuthenticated, async (req, res) => {
        let connection;
        try {
            connection = await dbPool.getConnection();
            await connection.query(`USE \`${process.env.DB_NAME}\``);
            const { favorite_id, condition_type, condition_value } = req.body;
            const userId = req.session.user.id;
            if (favorite_id === undefined || !condition_type) {
                return res.status(400).json({ message: '즐겨찾기 ID와 날씨 조건 종류는 필수입니다.' });
            }
            if ((condition_type === 'temp_gt' || condition_type === 'temp_lt') && condition_value === undefined) {
                return res.status(400).json({ message: '온도 조건에는 값이 필요합니다.' });
            }
            const [favs] = await connection.query("SELECT id, location_name FROM favorites WHERE id = ? AND user_id = ?", [favorite_id, userId]);
            if (favs.length === 0) {
                return res.status(404).json({ message: '해당 즐겨찾기를 찾을 수 없거나 권한이 없습니다.' });
            }
            const favoriteLocationName = favs[0].location_name;
            const sql = `INSERT INTO weather_subscriptions (user_id, favorite_id, condition_type, condition_value) VALUES (?, ?, ?, ?)`;
            const params = [userId, favorite_id, condition_type, condition_value || null];
            const [result] = await connection.query(sql, params);
            res.status(201).json({
                message: `'${favoriteLocationName}' 위치에 대한 날씨 구독 정보가 성공적으로 저장되었습니다.`,
                subscription: { id: result.insertId, user_id: userId, favorite_id: parseInt(favorite_id), location_name: favoriteLocationName, condition_type, condition_value: condition_value || null, is_active: true }
            });
            console.log(`사용자 ID ${userId}가 즐겨찾기 ID ${favorite_id} ('${favoriteLocationName}')에 대해 날씨 구독 추가: ${condition_type}`);
        } catch (error) {
            console.error("날씨 구독 추가 중 DB 오류:", error.message, error.stack);
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: '이미 해당 즐겨찾기에 동일한 조건으로 구독되어 있습니다.' });
            }
            return res.status(500).json({ message: `날씨 구독 추가 중 서버 오류가 발생했습니다: ${error.message}` });
        } finally {
            if (connection) connection.release();
        }
    });

    router.get('/weather-subscriptions', ensureAuthenticated, async (req, res) => {
        let connection;
        try {
            connection = await dbPool.getConnection();
            await connection.query(`USE \`${process.env.DB_NAME}\``);
            const userId = req.session.user.id;
            const sql = `
                SELECT ws.id, ws.favorite_id, f.location_name, f.latitude, f.longitude, ws.condition_type, ws.condition_value, ws.is_active, ws.created_at
                FROM weather_subscriptions ws JOIN favorites f ON ws.favorite_id = f.id
                WHERE ws.user_id = ? ORDER BY ws.created_at DESC
            `;
            const [subscriptions] = await connection.query(sql, [userId]);
            res.json(subscriptions);
        } catch (error) {
            console.error("날씨 구독 목록 조회 중 DB 오류:", error.message, error.stack);
            res.status(500).json({ message: `날씨 구독 목록을 불러오는 중 오류가 발생했습니다.` });
        } finally {
            if (connection) connection.release();
        }
    });

    router.delete('/weather-subscriptions/:id', ensureAuthenticated, async (req, res) => {
        let connection;
        try {
            connection = await dbPool.getConnection();
            await connection.query(`USE \`${process.env.DB_NAME}\``);
            const subscriptionId = req.params.id;
            const userId = req.session.user.id;
            const sql = `DELETE FROM weather_subscriptions WHERE id = ? AND user_id = ?`;
            const [result] = await connection.query(sql, [subscriptionId, userId]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: '해당 날씨 구독 정보를 찾을 수 없거나 삭제할 권한이 없습니다.' });
            }
            res.json({ message: '날씨 구독이 성공적으로 취소되었습니다.', subscriptionId: parseInt(subscriptionId) });
            console.log(`사용자 ID ${userId}가 날씨 구독 취소: ID ${subscriptionId}`);
        } catch (error) {
            console.error("날씨 구독 취소 중 DB 오류:", error.message, error.stack);
            res.status(500).json({ message: `날씨 구독 취소 중 오류가 발생했습니다.` });
        } finally {
            if (connection) connection.release();
        }
    });

    router.get('/weather-by-coords', async (req, res) => {
        const { lat, lon } = req.query;
        if (!lat || !lon) return res.status(400).json({ message: '위도(lat)와 경도(lon) 파라미터가 필요합니다.' });
        const apiKey = process.env.OPENWEATHERMAP_API_KEY_SECRET || process.env.OPENWEATHERMAP_API_KEY;
        if (!apiKey) {
            console.error('🔴 OpenWeatherMap API 키가 설정되지 않았습니다.');
            return res.status(500).json({ message: '서버에 날씨 API 키가 설정되지 않았습니다.' });
        }
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`;
        try {
            const response = await axios.get(weatherUrl);
            const weatherData = response.data;
            res.json({ 
                description: weatherData.weather[0].description, 
                temperature: weatherData.main.temp, 
                feels_like: weatherData.main.feels_like, 
                humidity: weatherData.main.humidity, 
                cityName: weatherData.name, 
                icon: weatherData.weather[0].icon 
            });
        } catch (error) { 
            console.error('❌ 좌표 기반 날씨 정보 가져오기 실패:', error.message); 
            res.status(500).json({ message: '날씨 정보를 가져오는 데 실패했습니다.' }); 
        }
    });

    router.get('/weather-forecast', async (req, res) => {
        const { lat, lon } = req.query;
        const apiKey = process.env.OPENWEATHERMAP_API_KEY_SECRET || process.env.OPENWEATHERMAP_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ message: '서버에 날씨 API 키가 설정되지 않았습니다.' });
        }
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`;
        try {
            const response = await axios.get(forecastUrl);
            const forecastData = response.data;
            const dailyForecasts = {};
            forecastData.list.forEach(item => { 
                const date = item.dt_txt.split(' ')[0]; 
                if (!dailyForecasts[date]) dailyForecasts[date] = { temps: [], weather_descriptions: [], icons: [] };
                dailyForecasts[date].temps.push(item.main.temp); 
                dailyForecasts[date].weather_descriptions.push(item.weather[0].description); 
                dailyForecasts[date].icons.push(item.weather[0].icon); 
            });
            const processedForecast = []; 
            Object.keys(dailyForecasts).slice(1, 4).forEach(date => {
                const dayData = dailyForecasts[date];
                processedForecast.push({
                    date: date,
                    temp_min: Math.min(...dayData.temps).toFixed(1),
                    temp_max: Math.max(...dayData.temps).toFixed(1),
                    description: dayData.weather_descriptions[Math.floor(dayData.weather_descriptions.length / 2)],
                    icon: dayData.icons[Math.floor(dayData.icons.length / 2)].replace('n', 'd')
                });
            });
            res.json({ cityName: forecastData.city.name, forecast: processedForecast });
        } catch (error) { 
            console.error('❌ 날씨 예보 정보 가져오기 실패:', error.message); 
            res.status(500).json({ message: '날씨 예보 정보를 가져오는 데 실패했습니다.' }); 
        }
    });

    router.get('/test/increment-signup', (req, res) => {
        usersRegisteredCounter.inc();
        console.log('✅ [Test] users_registered_total 메트릭이 1 증가했습니다.');
        res.status(200).send('OK: User registration counter incremented by 1.');
    });
    
    return router;
};
