const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const { Pool } = require('pg');
const session = require('express-session');


const nodemailer = require('nodemailer');
// Database connection setup
const pool = new Pool({
  user: 'u3m7grklvtlo6',
  host: '35.209.89.182',
  database: 'dbzvtfeophlfnr',
  password: 'AekAds@24',
  port: 5432,
});

const app = express();
const port = process.env.PORT || 10000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
// Use built-in middleware for parsing application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
const clients = {};
const statusClients = {};



// Set up session middleware
app.use(session({
  secret: 'kinjal123@',
  resave: false,
  saveUninitialized: true
}));

// WebSocket server
const wsServer = new WebSocket.Server({ noServer: true });

wsServer.on('connection', async (ws, req) => {
  const clientId = req.url.split('/').pop();
  if (!clientId || !/^\d+$/.test(clientId)) {
    console.log(`Invalid clientId: ${clientId}`);
    ws.close(); 
    return;
  }                                   

  if (clientId === 'status') {
    statusClients[ws] = true;
    console.log(`Status client connected`);
  } else {
    clients[clientId] = ws;
    const dateTime = new Date().toISOString(); // Updated format
    
    // Insert or update the client status in the database
    await pool.query(
      'INSERT INTO client_statuses (client_name, status, updated_at) VALUES ($1, $2, $3) ON CONFLICT (client_name) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at',
      [clientId, 'online', dateTime]
    );

    console.log(`Client ${clientId} connected`);
    broadcastStatus(clientId, 'online', dateTime);
  }




// Function to save message to the database
const saveMessage = async (data) => {
  try {
    // Debug log to verify incoming data
    console.log('Incoming data:', data);

    // Ensure the `id` is present and parsed correctly from the data
    const query = `
      INSERT INTO screenshots (id, type, filename, image_url, size)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id)
      DO UPDATE SET 
        type = EXCLUDED.type,
        filename = EXCLUDED.filename,
        image_url = EXCLUDED.image_url,
        size = EXCLUDED.size;
    `;

    // Ensure you're passing the correct data keys (Id vs id)
    const values = [data.Id || data.id, data.type, data.filename, data.imageUrl, data.size];

    // Execute the query
    await pool.query(query, values);
    console.log('Data saved successfully.');
  } catch (error) {
    // Handle errors and log them for debugging
    console.error('Error saving data:', error);
  }
};





  ws.on('message', (message) => {
    try {
      // Parse the received message
      const parsedMessage = JSON.parse(message);
      console.log('Received message:', parsedMessage);

      // Save the parsed message to the database
      saveMessage(parsedMessage);

      // Send a confirmation back to the client
     
    } catch (error) {
      console.error('Error processing message:', error);
     
    }
  });



ws.on('message', async (message) => {
  console.log(`Received message from ${clientId}: ${message}`);

  let data;
  try {
    data = JSON.parse(message);
  } catch (error) {
    console.error(`Failed to parse message: ${message}`, error);
    return; // Exit early if message parsing fails
  }

  console.log(`Parsed data from message:`, data);

  const dateTime = new Date().toISOString(); // Updated format

  if (data.type === 'network') {
    console.log(`Network status data received:`, data);

    // Store network status in the database
    try {
      await pool.query(
        'INSERT INTO network_statuses (client_name, status, updated_at) VALUES ($1, $2, $3) ON CONFLICT (client_name) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at',
        [data.clientId, data.status, dateTime]
      );

      console.log(`Network status updated in database for client ${data.clientId}: ${data.status} at ${dateTime}`);
    } catch (error) {
      console.error(`Failed to update network status in database:`, error);
    }
  } if (data.type === 'Device_Config') {
    console.log(`Device configuration data received:`, data);

    // Store device configuration data in the database
    try {
      await pool.query(
        'INSERT INTO device_configs (client_name, ram_total, ram_used, storage_total, storage_used, resolution, downstream_bandwidth, upstream_bandwidth, manufacturer, model, os_version, wifi_enabled, wifi_mac_address, wifi_network_ssid, wifi_signal_strength_dbm, android_id, IfSecondScreenIsPresentOnDevice, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) ON CONFLICT (client_name) DO UPDATE SET ram_total = EXCLUDED.ram_total, ram_used = EXCLUDED.ram_used, storage_total = EXCLUDED.storage_total, storage_used = EXCLUDED.storage_used, resolution = EXCLUDED.resolution, downstream_bandwidth = EXCLUDED.downstream_bandwidth, upstream_bandwidth = EXCLUDED.upstream_bandwidth, manufacturer = EXCLUDED.manufacturer, model = EXCLUDED.model, os_version = EXCLUDED.os_version, wifi_enabled = EXCLUDED.wifi_enabled, wifi_mac_address = EXCLUDED.wifi_mac_address, wifi_network_ssid = EXCLUDED.wifi_network_ssid, wifi_signal_strength_dbm = EXCLUDED.wifi_signal_strength_dbm, android_id = EXCLUDED.android_id, IfSecondScreenIsPresentOnDevice = EXCLUDED.IfSecondScreenIsPresentOnDevice, updated_at = EXCLUDED.updated_at',
        [
          clientId,
          data.ram_total,
          data.ram_used,
          data.storage_total,
          data.storage_used,
          data['Screen-resolution'],
          data.downstream_bandwidth,
          data.upstream_bandwidth,

          data.manufacturer,
          data.model,
          data.os_version,
          data.wifiEnabled,
          data.wifiMacAddress,
          data.wifiNetworkSSID,
          data.wifiSignalStrengthdBm,
          data.androidId,
          data.IfSecondScreenIsPresentOnDevice, // Updated field as integer
          dateTime,
        ]
      );

      console.log(`Device configuration updated in database for client ${clientId} at ${dateTime}`);
    } catch (error) {
      console.error(`Failed to update device configuration in database:`, error);
    }
  } else {
    console.log(`Received non-network and non-Device_Config data:`, data);
  }
});























  
  ws.on('close', async () => {
    if (clientId !== 'status') {
      delete clients[clientId];
      const dateTime = new Date().toISOString(); // Updated format
      
      // Update the client status in the database
      await pool.query(
        'UPDATE client_statuses SET status = $1, updated_at = $2 WHERE client_name = $3',
        ['offline', dateTime, clientId]
      );

      console.log(`Client ${clientId} disconnected`);
      broadcastStatus(clientId, 'offline', dateTime);
    } else {
      console.log(`Status client disconnected`);
    }
  });
});

// Broadcast client status to status clients
function broadcastStatus(clientId, status, dateTime) {
  const statusMessage = JSON.stringify({ clientId, status, dateTime });
  Object.keys(statusClients).forEach((client) => client.send(statusMessage));
  console.log(`Broadcasting status: ${statusMessage}`);
}

// Periodically check client statuses every 20 seconds
setInterval(() => {
  Object.keys(clients).forEach(async (clientId) => {
    const ws = clients[clientId];
    const dateTime = new Date().toISOString(); // Updated format

    if (ws.readyState === WebSocket.OPEN) {
      console.log(`Checking status for client ${clientId}`);

      // Send a ping message to check the connection
      ws.send(JSON.stringify({ type: 'ping', message: 'p' }));
      console.log(`Ping sent to client ${clientId}`);

      // Update the status in the database
      try {
        await pool.query(
          'UPDATE client_statuses SET status = $1, updated_at = $2 WHERE client_name = $3',
          ['online', dateTime, clientId]
        );
        console.log(`Client ${clientId} status updated to online at ${dateTime}`);
      } catch (error) {
        console.error(`Error updating client ${clientId} status:`, error);
      }
    } else {
      // Client is disconnected
      delete clients[clientId];
      console.log(`Client ${clientId} is disconnected`);

      try {
        await pool.query(
          'UPDATE client_statuses SET status = $1, updated_at = $2 WHERE client_name = $3',
          ['offline', dateTime, clientId]
        );
        console.log(`Client ${clientId} marked as offline at ${dateTime}`);
        broadcastStatus(clientId, 'offline', dateTime);
      } catch (error) {
        console.error(`Error updating client ${clientId} status:`, error);
      }
    }
  });
}, 20000);

// HTTP server and WebSocket upgrade
const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

server.on('upgrade', (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, (ws) => {
    wsServer.emit('connection', ws, request);
  });
});

// Routes
app.get('/client/:id', async (req, res) => {
  const clientId = req.params.id;
  if (!clientId || !/^\d+$/.test(clientId)) {
    console.log(`Client ID not found: ${clientId}`);
    return res.status(404).send('Client not found');
  }

  console.log(`Rendering client page for Client ${clientId}`);
  res.render('client', { clientId });
});







let isAuthenticated = false; // Simple flag for authentication

// Middleware to check access and store the originally requested URL
const checkAccess = (req, res, next) => {
  console.log("Middleware: In checkAccess");

  if (isAuthenticated) {
    console.log("Middleware: User is already authenticated");
    return next(); // Proceed if the user is authenticated
  }

  // Store the requested URL in the session and redirect to login page
  req.session.returnTo = req.originalUrl;
  console.log(" req.session.returnTo..........", req.session.returnTo);
  console.log("Middleware: User is not authenticated, redirecting to login");
  res.redirect('/access'); // Redirect to login page if not authenticated
};




app.get('/status', checkAccess,async (req, res) => {
  // Retrieve client statuses from the database
  const clientStatusResult = await pool.query('SELECT client_name, status, updated_at FROM client_statuses');
  const screensResult = await pool.query('SELECT * FROM screens');
// Extract screen data from the result
const screens = screensResult.rows;
// console.log("screens",screens);

  const clientStatuses = {};
  clientStatusResult.rows.forEach(row => {
    clientStatuses[row.client_name] = { status: row.status, dateTime: row.updated_at };
  });

  // Retrieve network statuses from the database
  const networkStatusResult = await pool.query('SELECT client_name, status, updated_at FROM network_statuses');
  const networkStatuses = {};
  networkStatusResult.rows.forEach(row => {
    networkStatuses[row.client_name] = { status: row.status, dateTime: row.updated_at };
  });


  console.log('Rendering status page with client and network data');
  res.render('status', { clientStatuses, networkStatuses, screens});
});








// Create a Nodemailer transporter (using Gmail as an example)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
        user: 'aekads.otp@gmail.com',
        pass: 'ntkp cloo wjnx atep'
  }
});

// Function to send an email when a command is issued
const sendEmail = (clientId, action) => {
  const mailOptions = {
    from: 'aekads.otp@gmail.com',
    to: 'sahasaek221@gmail.com', // Recipient emails
    subject: `${action} Command Sent to Client ${clientId}`,
    text: `The ${action} command has been successfully sent to client ${clientId}.`,
    html: `<p>The ${action} command has been successfully sent to client <strong>${clientId}</strong>.</p>`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
};

// Restart command
app.post('/restart-client/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'RESTART', message: 'Restart app' }));
    sendEmail(clientId, 'Restart');
    res.json({ message: `Restart command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Update App command
app.post('/update-app/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    const updateMessage = 'https://www.dropbox.com/scl/fi/t0st6degn19r0wexxb22v/AekApp2-9.apk?rlkey=vp0z6483rkpbc6dv6mnn6l5xs&st=v1hmqnvp&dl=1';
    ws.send(JSON.stringify({ type: 'UPDATE-APP_TO', message: updateMessage }));
    sendEmail(clientId, 'Update App');
    res.json({
      message: `Update command sent to client ${clientId}`,
      updateMessage: updateMessage
    });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Volume Up command
app.post('/volume-up/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'VOLUME_UP', message: 'Increase volume' }));
    sendEmail(clientId, 'Volume Up');
    res.json({ message: `Volume up command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Volume Down command
app.post('/volume-down/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'VOLUME_DOWN', message: 'Decrease volume' }));
    sendEmail(clientId, 'Volume Down');
    res.json({ message: `Volume down command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Mute command
app.post('/mute-client/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'MUTE', message: 'Mute client' }));
    sendEmail(clientId, 'Mute');
    res.json({ message: `Mute command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Unmute command
app.post('/unmute-client/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'UN_MUTE', message: 'Unmute client' }));
    sendEmail(clientId, 'Unmute');
    res.json({ message: `Unmute command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Screen Sort command
app.post('/screen-sort/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'SCREEN_SORT', message: 'Sort screens' }));
    sendEmail(clientId, 'Screen Sort');
    res.json({ message: `Screen sort command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Dhvanil command
app.post('/Dhvanil/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'SAKI_SHOT', message: 'dhvanil client' }));
    sendEmail(clientId, 'Dhvanil');
    res.json({ message: `Dhvanil command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// RBT command
app.post('/rbt/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'SAKI_RBT', message: 'dhvanil client' }));
    sendEmail(clientId, 'RBT');
    res.json({ message: `RBT command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Brightness Up command
app.post('/BRIGHTNESS_UP/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'BRIGHTNESS_UP', message: 'dhvanil client' }));
    sendEmail(clientId, 'Brightness Up');
    res.json({ message: `Brightness UP command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Brightness Down command
app.post('/BRIGHTNESS_DOWN/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'BRIGHTNESS_DOWN', message: 'dhvanil client' }));
    sendEmail(clientId, 'Brightness Down');
    res.json({ message: `Brightness DOWN command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Update App Saki command
app.post('/UPDATE_APP_SAKI/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'UPDATE_APP_SAKI', message: 'dhvanil client' }));
    sendEmail(clientId, 'Update App Saki');
    res.json({ message: `UPDATE APP command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Clear Code Pairing command
app.post('/CLEAR_CODE_PARING_AND_SCREEN_ID/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'CLEAR_CODE_PARING_AND_SCREEN_ID', message: 'dhvanil client' }));
    sendEmail(clientId, 'Clear Code Pairing');
    res.json({ message: `Clear code pairing and screen ID command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});



// EXO_PLAYER_VOL_UP command
app.post('/EXO_PLAYER_VOL_UP/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'EXO_PLAYER_VOL_UP', message: 'dhvanil client' }));
    sendEmail(clientId, 'EXO_PLAYER_VOL_UP');
    res.json({ message: `EXO_PLAYER_VOL_UP command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// EXO_PLAYER_VOL_DOWN command
app.post('/EXO_PLAYER_VOL_DOWN/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'EXO_PLAYER_VOL_DOWN', message: 'dhvanil client' }));
    sendEmail(clientId, 'EXO_PLAYER_VOL_DOWN');
    res.json({ message: `EXO_PLAYER_VOL_DOWN command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// YOUTUBE_VOL_UP command
app.post('/YOUTUBE_VOL_UP/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'YOUTUBE_VOL_UP', message: 'dhvanil client' }));
    sendEmail(clientId, 'YOUTUBE_VOL_UP');
    res.json({ message: `YOUTUBE_VOL_UP command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// YOUTUBE_VOL_DOWN command
app.post('/YOUTUBE_VOL_DOWN/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'YOUTUBE_VOL_DOWN', message: 'dhvanil client' }));
    sendEmail(clientId, 'YOUTUBE_VOL_DOWN');
    res.json({ message: `YOUTUBE_VOL_DOWN command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});








app.post('/set-volume/:id', (req, res) => {
  const clientId = req.params.id;
  const volumeValue = req.body.volume; // Ensure body parsing middleware is used (e.g., express.json())
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
  // Send a JSON message with the volume value as part of the message string
   ws.send(JSON.stringify({ type: 'SET_VOLUME', message: ` ${parseInt(volumeValue)}`, value: volumeValue }));

//     // Save or update the volume setting to the database (upsert)
    try {
     const result = await pool.query(
      `INSERT INTO volume_changes (client_id, volume, timestamp)
       VALUES ($1, $2, $3)
        ON CONFLICT (client_id) 
        DO UPDATE SET volume = $2, timestamp = $3`,
     [clientId, volumeValue, timestamp]
      );
      console.log('Volume change saved/updated in database:', result);
   } catch (error) {
     console.error('Error saving/updating volume change in database:', error);
     return res.status(500).json({ message: 'Failed to save/update volume change' });
   }

  // Optional: send an email notification when the volume is set
 sendEmail(clientId, `Volume set to ${volumeValue}`);

  res.json({ message: `Set volume command sent to client ${clientId} with value ${volumeValue}` });
 } else {
   res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});





// app.post('/set-volume/:id', async (req, res) => {
//   const clientId = req.params.id;
//   const volumeValue = req.body.volume; // Ensure body parsing middleware is used (e.g., express.json())
//   const ws = clients[clientId];

//   // Get the current timestamp and convert it to IST (Asia/Kolkata)
//   const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

//   if (ws && ws.readyState === WebSocket.OPEN) {
//     // Send a JSON message with the volume value as part of the message string
//     ws.send(JSON.stringify({ type: 'SET_VOLUME', message: `Set volume to ${parseInt(volumeValue)}`, value: volumeValue }));

//     // Save or update the volume setting to the database (upsert)
//     try {
//       const result = await pool.query(
//         `INSERT INTO volume_changes (client_id, volume, timestamp)
//          VALUES ($1, $2, $3)
//          ON CONFLICT (client_id) 
//          DO UPDATE SET volume = $2, timestamp = $3`,
//         [clientId, volumeValue, timestamp]
//       );
//       console.log('Volume change saved/updated in database:', result);
//     } catch (error) {
//       console.error('Error saving/updating volume change in database:', error);
//       return res.status(500).json({ message: 'Failed to save/update volume change' });
//     }

//     // Optional: send an email notification when the volume is set
//     sendEmail(clientId, `Volume set to ${volumeValue}`);

//     res.json({ message: `Set volume command sent to client ${clientId} with value ${volumeValue}` });
//   } else {
//     res.status(404).json({ message: `Client ${clientId} is not connected` });
//   }
// });


// Route to delete a client
app.post('/delete-client/:id', async (req, res) => {
  const clientId = req.params.id;

  try {
    // Delete the client from client_statuses table
    const deleteQuery = 'DELETE FROM client_statuses WHERE client_name = $1';
    await pool.query(deleteQuery, [clientId]);

    // Send an email after client deletion
    sendEmail('Client Deletion', `Client ${clientId} has been deleted from the system.`);

    res.status(200).send({ message: 'Client deleted successfully.' });
  } catch (err) {
    console.error('Error deleting client:', err);
    res.status(500).send({ error: 'Failed to delete client.' });
  }
});

// Route to perform master restart on all connected clients
app.post('/master-restart', (req, res) => {
  const clientIds = Object.keys(clients);
  const restartMessage = { type: 'RESTART', message: 'restart app' };

  clientIds.forEach(clientId => {
    const ws = clients[clientId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(restartMessage));
      console.log(`Restart command sent to client ${clientId}`);
    }
  });

  // Send an email after master restart command
  sendEmail('Master Restart', 'The master restart command has been sent to all connected clients.');

  res.json({ message: 'Restart command sent to all connected clients' });
});


// app.post('/send-dhvanil-command/:clientId', (req, res) => {
//   const clientId = req.params.clientId;
  
//   // Send command to the client (details depend on your communication with the client)
//   sendCommandToClient(clientId, 'Dhvanil', (clientData) => {
//     if (clientData) {
//       res.json({
//         filename: clientData.filename,
//         image: clientData.image,
//         size: clientData.size
//       });
//     } else {
//       res.status(500).json({ message: 'Failed to get data from the client' });
//     }
//   });
// });

// app.post('/save-dhvanil-data', (req, res) => {
//   const { type, filename, image, size, Id } = req.body;

//   // Replace this with your actual PostgreSQL query
//   const query = `
//     INSERT INTO dhvanil_data (type, filename, image, size, client_id)
//     VALUES ($1, $2, $3, $4, $5)
//     ON CONFLICT (client_id) 
//     DO UPDATE SET 
//       type = EXCLUDED.type, 
//       filename = EXCLUDED.filename, 
//       image = EXCLUDED.image, 
//       size = EXCLUDED.size;
//   `;

//   const values = [type, filename, image, size, Id];

//   db.query(query, values, (error, result) => {
//     if (error) {
//       console.error('Error saving data:', error);
//       res.status(500).json({ message: 'Error saving data' });
//     } else {
//       res.json({ message: 'Data saved successfully' });
//     }
//   });
// });












// Schedule the master-restart every minute
setInterval(() => {
  const clientIds = Object.keys(clients);
  const restartMessage = { type: 'RESTART', message: 'restart app' };

  clientIds.forEach(clientId => {
    const ws = clients[clientId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(restartMessage));
      console.log(`Restart command sent to client ${clientId}`);
    }
  });

  console.log('Scheduled restart command sent to all connected clients');
}, 3600000); // 3600000 milliseconds = 1 hour





// Restart client command
app.get('/restart-client/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'RESTART', message: 'restart app' }));
    sendEmail(clientId, 'RESTART');
    res.json({ message: `Restart command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Volume up command
app.get('/volume-up/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'VOLUME_UP', message: 'Increase volume' }));
    sendEmail(clientId, 'VOLUME_UP');
    res.json({ message: `Volume up command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Volume down command
app.get('/volume-down/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'VOLUME_DOWN', message: 'Decrease volume' }));
    sendEmail(clientId, 'VOLUME_DOWN');
    res.json({ message: `Volume down command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Mute client command
app.get('/mute-client/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'MUTE', message: 'Mute client' }));
    sendEmail(clientId, 'MUTE');
    res.json({ message: `Mute command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Unmute client command
app.get('/unmute-client/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'UN_MUTE', message: 'Unmute client' }));
    sendEmail(clientId, 'UN_MUTE');
    res.json({ message: `Unmute command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Screen sort command
app.get('/screen-sort/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'SCREEN_SORT', message: 'Sort screens' }));
    sendEmail(clientId, 'SCREEN_SORT');
    res.json({ message: `Screen sort command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Dhvanil command
app.get('/Dhvanil/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'SAKI_SHOT', message: 'dhvanil client' }));
    sendEmail(clientId, 'SAKI_SHOT');
    res.json({ message: `dhvanil command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// RBT command
app.get('/rbt/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'SAKI_RBT', message: 'dhvanil client' }));
    sendEmail(clientId, 'SAKI_RBT');
    res.json({ message: `RBT command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Brightness up command
app.get('/BRIGHTNESS_UP/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'BRIGHTNESS_UP', message: 'dhvanil client' }));
    sendEmail(clientId, 'BRIGHTNESS_UP');
    res.json({ message: `BRIGHTNESS UP command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Brightness down command
app.get('/BRIGHTNESS_DOWN/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'BRIGHTNESS_DOWN', message: 'dhvanil client' }));
    sendEmail(clientId, 'BRIGHTNESS_DOWN');
    res.json({ message: `BRIGHTNESS DOWN command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Update app Saki command
app.get('/UPDATE_APP_SAKI/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'UPDATE_APP_SAKI', message: 'dhvanil client' }));
    sendEmail(clientId, 'UPDATE_APP_SAKI');
    res.json({ message: `UPDATE APP command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// Clear pairing and screen ID command
app.get('/CLEAR_CODE_PARING_AND_SCREEN_ID/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'CLEAR_CODE_PARING_AND_SCREEN_ID', message: 'dhvanil client' }));
    sendEmail(clientId, 'CLEAR_CODE_PARING_AND_SCREEN_ID');
    res.json({ message: `CLEAR DATA command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// EXO_PLAYER_VOL_UP command
app.get('/EXO_PLAYER_VOL_UP/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'EXO_PLAYER_VOL_UP', message: 'dhvanil client' }));
    sendEmail(clientId, 'EXO_PLAYER_VOL_UP');
    res.json({ message: `EXO_PLAYER_VOL_UP command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

// EXO_PLAYER_VOL_DOWN command
app.get('/EXO_PLAYER_VOL_DOWN/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'EXO_PLAYER_VOL_DOWN', message: 'dhvanil client' }));
    sendEmail(clientId, 'EXO_PLAYER_VOL_DOWN');
    res.json({ message: `EXO_PLAYER_VOL_DOWN command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});






// Route to delete a client
app.get('/delete-client/:id', async (req, res) => {
  const clientId = req.params.id;

  try {
    const deleteQuery = 'DELETE FROM client_statuses WHERE client_name = $1';
    await pool.query(deleteQuery, [clientId]);

    // Send an email after client deletion
    sendEmail('Client Deletion', `Client ${clientId} has been deleted from the system.`);

    res.status(200).send({ message: 'Client deleted successfully.' });
  } catch (err) {
    console.error('Error deleting client:', err);
    res.status(500).send({ error: 'Failed to delete client.' });
  }
});

// Route to perform master restart on all connected clients
app.get('/master-restart', (req, res) => {
  const clientIds = Object.keys(clients);
  const restartMessage = { type: 'RESTART', message: 'restart app' };

  clientIds.forEach(clientId => {
    const ws = clients[clientId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(restartMessage));
      console.log(`Restart command sent to client ${clientId}`);
    }
  });

  // Send an email after master restart command
  sendEmail('Master Restart', 'The master restart command has been sent to all connected clients.');

  res.json({ message: 'Restart command sent to all connected clients' });
});













// let isAuthenticated = false; // Simple flag for authentication

// // Middleware to check access
// const checkAccess = (req, res, next) => {
//   console.log("Middleware: In checkAccess");

//   if (isAuthenticated) {
//     console.log("Middleware: User is already authenticated");
//     return next(); // Proceed if the user is authenticated
//   }

//   const { username, password } = req.body;
//   console.log(`Middleware: Received credentials -> username: ${username}, password: ${password}`);

//   // Array of valid credentials
//   const validCredentials = [
//     { username: 'dhvanil', password: 'dhvanil1403@' },
//     { username: 'sahas', password: '1248163264' }
//   ];

//   // Check if the provided credentials match any valid ones
//   const isValidUser = validCredentials.some(cred => 
//     cred.username === username && cred.password === password
//   );

//   if (isValidUser) {
//     isAuthenticated = true; // Mark user as authenticated
//     console.log("Middleware: Authentication successful");
//     next();
//   } else {
//     console.log("Middleware: Authentication failed");
//     res.status(401).send('Unauthorized');
//   }
// };

// Route to render the login page
app.get('/access', (req, res) => {
  console.log("GET /access: Rendering login page");
  res.render('access'); // Render the login page (access.ejs)
});

// Route to handle form submission for access (login)
// Login route to authenticate the user
app.post('/access', (req, res) => {
  const { username, password } = req.body;
  console.log(`POST /access: Received credentials -> username: ${username}, password: ${password}`);

  // Array of valid credentials
  const validCredentials = [
    { username: 'dhvanil', password: 'dhvanil1403@' },
    { username: 'sahas', password: '1248163264' }
  ];

  // Check if the provided credentials match any valid ones
  const isValidUser = validCredentials.some(cred => 
    cred.username === username && cred.password === password
  );

  if (isValidUser) {
    isAuthenticated = true; // Mark user as authenticated
    console.log("POST /access: Authentication successful");

    // Redirect to the originally requested page or default to '/screenshots'
    const redirectPath = req.session.returnTo || '/screenshots';
    console.log("redirectPath",redirectPath);
    
    delete req.session.returnTo; // Clear the saved path from the session
    res.redirect(redirectPath); // Redirect to the intended route
  } else {
    console.log("POST /access: Authentication failed");
    res.status(401).send('Unauthorized');
  }
});


// // Route to fetch all screenshots data
// app.get('/screenshots', (req, res) => {
//   console.log("GET /screenshots: User is trying to access screenshots");

//   if (!isAuthenticated) {
//     console.log("GET /screenshots: User is not authenticated, redirecting to /access");
//     return res.redirect('/access'); // If not authenticated, redirect to access page
//   }

//   // User is authenticated, fetch data
//   console.log("GET /screenshots: User is authenticated, fetching screenshots data");
//   pool.query('SELECT * FROM screenshots', (error, result) => {
//     if (error) {
//       console.error("Error fetching data from database:", error);
//       return res.status(500).send('Error fetching data');
//     }

//     console.log("GET /screenshots: Data fetched successfully, rendering screenshots page");
//     res.render('screenshots', { screenshots: result.rows }); // Render 'screenshots.ejs'
//   });
// });



// Route to fetch all screenshots, screens, and client status data
app.get('/screenshots', checkAccess, (req, res) => {
  console.log("GET /screenshots: User is trying to access screenshots");

  if (!isAuthenticated) {
    console.log("GET /screenshots: User is not authenticated, redirecting to /access");
    return res.redirect('/access'); // If not authenticated, redirect to access page
  }

  console.log("GET /screenshots: User is authenticated, fetching data");

  // Define the queries to fetch data from each table
  const screenshotQuery = 'SELECT * FROM screenshots';
  const screensQuery = 'SELECT * FROM screens';
  const clientStatusQuery = 'SELECT * FROM client_statuses';

  // Run queries in parallel
  Promise.all([
    pool.query(screenshotQuery),
    pool.query(screensQuery),
    pool.query(clientStatusQuery)
  ])
    .then(results => {
      const screenshots = results[0].rows;
      const screens = results[1].rows;
      const clientStatuses = results[2].rows; // Assuming this is an array of objects

      console.log("GET /screenshots: Data fetched successfully, rendering screenshots page");

      // Render the EJS view with all three sets of data
      res.render('screenshots', { screenshots, screens, clientStatuses });
    })
    .catch(error => {
      console.error("Error fetching data from database:", error);
      res.status(500).send('Error fetching data');
    });
});
