const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 1, role: 'ADMIN', shop_id: 1 }, process.env.JWT_SECRET || 'super_secret_pos_key_2026', { expiresIn: '1h' });
fetch('http://localhost:3000/api/sales', { headers: { 'Authorization': `Bearer ${token}` } })
  .then(r => r.json())
  .then(data => {
     if (data.data && data.data.length > 0) {
        const id = data.data[0].id;
        console.log("deleting sale", id);
        return fetch(`http://localhost:3000/api/sales/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
     }
  })
  .then(r => r ? r.json() : null)
  .then(console.log);
