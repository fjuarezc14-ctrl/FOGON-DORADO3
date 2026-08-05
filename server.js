const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors()); // Permite que tu HTML (Frontend) se comunique con este Backend
app.use(express.static('public')); // Permite recibir datos en formato JSON

// Configuración de la conexión a MySQL
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Probar conexión a la base de datos
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Error conectando a la base de datos:', err.message);
    } else {
        console.log('✅ Conectado exitosamente a la base de datos MySQL');
        connection.release();
    }
});

// ==========================================
// RUTAS DE PRUEBA (API REST)
// ==========================================

// Ruta para ver si el servidor funciona
app.get('/api/status', (req, res) => {
    res.json({ mensaje: '¡El backend de Chicken ERP está funcionando al 100%'});
});

// Ruta para obtener todas las mesas y su estado
app.get('/api/mesas', (req, res) => {
    const query = 'SELECT * FROM mesas';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Formateamos los datos para que sean compatibles con el frontend actual
        const mesasFormateadas = results.map(mesa => ({
            id: mesa.id,
            num: mesa.numero.replace('Mesa ', ''), // Extrae solo el número
            estado: mesa.estado,
            pedidoData: null // Por ahora null, luego lo conectaremos con la tabla pedidos
        }));
        
        res.json(mesasFormateadas);
    });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});