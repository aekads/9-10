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
ws.on('message', async (message) => {
  console.log(`\n[INFO] Received message: ${message}`);

  let data;
  try {
    // Parse the incoming message
    data = JSON.parse(message);
    console.log('[INFO] Parsed message successfully.');
  } catch (error) {
    console.error('[ERROR] Failed to parse message:', error.message);
    ws.send(JSON.stringify({ status: 'error', message: 'Invalid JSON format.' }));
    return; // Exit if the message isn't valid JSON
  }

  const dateTime = new Date().toISOString();
  console.log(`[INFO] Current timestamp: ${dateTime}`);

  if (data.type === 'video_impression') {
    console.log('[INFO] Processing "video_impression" message.');

    try {
      // Validate required fields and types
      const requiredFields = ['video_id', 'screen_id', 'device_id', 'name', 'count', 'duration'];
      for (const field of requiredFields) {
        if (!data[field] || (typeof data[field] !== 'number' && typeof data[field] !== 'string')) {
          throw new Error(`Missing or invalid field: ${field}`);
        }
      }

      const IST_OFFSET_SECONDS = 19800; // +5:30 offset in seconds
      const timestampInSeconds = Math.floor(data.timestamp / 1000) + IST_OFFSET_SECONDS;
      const uploadedTimeInSeconds = Math.floor((data.uploaded_time_timestamp || Date.now()) / 1000) + IST_OFFSET_SECONDS;

      const query = `
        INSERT INTO video_impressions (type, video_id, screen_id, device_id, name, count, duration, "timestamp", uploaded_time_timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TO_TIMESTAMP($8), TO_TIMESTAMP($9))
      `;

      // Log the query parameters for debugging
      const queryParams = [
        data.type,
        data.video_id,
        data.screen_id,
        data.device_id,
        data.name,
        data.count,
        data.duration,
        timestampInSeconds,
        uploadedTimeInSeconds,
      ];
      console.log('[INFO] Query parameters:', queryParams);

      // Execute the query
      await pool.query(query, queryParams);

      console.log(`[SUCCESS] Video impression data saved for video ID: ${data.video_id}.`);
      ws.send(JSON.stringify({ status: 'success', message: 'Data saved successfully.' }));
    } catch (error) {
      const errorMessage = `Failed to save video impression data: ${error.message}`;
      console.error('[ERROR]', errorMessage);

      ws.send(JSON.stringify({ status: 'error', message: errorMessage }));
    }
  } else {
    const errorMessage = 'Invalid message type';
    console.warn('[WARNING]', errorMessage);

    ws.send(JSON.stringify({ status: 'error', message: errorMessage }));
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







// Middleware to check if user is authenticated
function isAuthenticated1(req, res, next) {
  if (req.session.isAuthenticated1) {
    return next(); // Proceed to the next middleware or route handler
  } else {
    res.redirect('/login'); // Redirect to login if not authenticated
  }
}

// Simple login route
app.get('/login', (req, res) => {
  res.render('login'); // Render a login page (e.g., login.ejs)
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Replace with your actual authentication logic
  if (
    (username === 'dhvanil' && password === 'dhvanil1403@') ||
    (username === 'sahas' && password === '1248163264')
  ) {
    req.session.isAuthenticated1 = true;
    res.redirect('/update'); // Redirect to the protected status page
  } else {
    res.status(401).send('Unauthorized: Invalid username or password');
  }
  
});


// Route to display status page with data from database
app.get('/update', isAuthenticated1, async (req, res) => {
  try {
    // Retrieve client statuses from the database
    const clientStatusResult = await pool.query('SELECT client_name, status, updated_at, power_times FROM client_statuses');
    const screensResult = await pool.query('SELECT * FROM screens');
    
    // Extract screen data from the result
    const screens = screensResult.rows;

    const clientStatuses = {};
    clientStatusResult.rows.forEach(row => {
      clientStatuses[row.client_name] = { 
        status: row.status, 
        dateTime: row.updated_at, 
        power_times: row.power_times // Include power_times here
      };
    });

    // Retrieve network statuses from the database
    const networkStatusResult = await pool.query('SELECT client_name, status, updated_at FROM network_statuses');
    const networkStatuses = {};
    networkStatusResult.rows.forEach(row => {
      networkStatuses[row.client_name] = { status: row.status, dateTime: row.updated_at };
    });

    console.log('Rendering status page with client and network data');
    res.render('status', { clientStatuses, networkStatuses, screens });
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('An error occurred while fetching data.');
  }
});



app.get('/status', isAuthenticated1, async (req, res) => {
  try {
    // Retrieve client statuses from the database
    const clientStatusResult = await pool.query('SELECT client_name, status, updated_at, power_times FROM client_statuses');
    const screensResult = await pool.query('SELECT * FROM screens');
    
    // Extract screen data from the result
    const screens = screensResult.rows;

    const clientStatuses = {};
    clientStatusResult.rows.forEach(row => {
      clientStatuses[row.client_name] = { 
        status: row.status, 
        dateTime: row.updated_at, 
        power_times: row.power_times // Include power_times here
      };
    });

    // Retrieve network statuses from the database
    const networkStatusResult = await pool.query('SELECT client_name, status, updated_at FROM network_statuses');
    const networkStatuses = {};
    networkStatusResult.rows.forEach(row => {
      networkStatuses[row.client_name] = { status: row.status, dateTime: row.updated_at };
    });

    console.log('Rendering status page with client and network data');
    res.render('status', { clientStatuses, networkStatuses, screens });
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('An error occurred while fetching data.');
  }
});











// Create a Nodemailer transporter (using Gmail as an example)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
        user: 'aekads.otp@gmail.com',
        pass: 'ieef ozwv pfny gykx'
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

app.post('/CLEAR_TIME/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'CLEAR_TIME', message: '' }));
    sendEmail(clientId, 'CLEAR_TIME');
    res.json({ message: `CLEAR_TIME command sent to client ${clientId}` });
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
    ws.send(JSON.stringify({ type: 'UPDATE_APP_SAKI', message: 'https://www.dropbox.com/scl/fi/ptdezmf2mtegam2dedoy0/aekads05.apk?rlkey=pmyrwwqy72hz6hd2ynv23t8an&st=m0j0fy36&raw=1' }));
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


app.post('/BOTH_SCREENS_SCREENSORT/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'BOTH_SCREENS_SCREENSORT', message: 'BOTH_SCREENS_SCREENSORT' }));
    sendEmail(clientId, 'BOTH_SCREENS_SCREENSORT');
    res.json({ message: `BOTH_SCREENS_SCREENSORT command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

app.post('/SAKI_SHOT_SML/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'SAKI_SHOT_SML', message: 'SAKI_SHOT_SML' }));
    sendEmail(clientId, 'SAKI_SHOT_SML');
    res.json({ message: `SAKI_SHOT_SML command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});


app.post('/SS_DTA_DLT/:id', (req, res) => {
  const clientId = req.params.id;
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'SS_DTA_DLT', message: 'SS_DTA_DLT' }));
    sendEmail(clientId, 'SS_DTA_DLT');
    res.json({ message: `SS_DTA_DLT command sent to client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});

app.post('/set-power-times/:id', async (req, res) => {
  const clientId = parseInt(req.params.id, 10); // Ensure clientId is an integer
  const { times } = req.body; // Expecting a string like "06:00-22:00"
  const ws = clients[clientId];

  if (!times || typeof times !== 'string') {
    return res.status(400).json({ message: 'Invalid times format' });
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({ type: 'SET_POWER_TIMES', message: times }), async (error) => {
        if (error) {
          console.error('Error sending WebSocket message:', error);
          return res.status(500).json({ message: 'Failed to send message to client', error: error.message });
        }

        try {
          const updateQuery = `
            UPDATE public.client_statuses 
            SET power_times = $1
            WHERE client_name = $2;
          `;
          const updateResult = await pool.query(updateQuery, [times, clientId]);

          if (updateResult.rowCount === 0) {
            return res.status(404).json({ message: `Client ID ${clientId} not found in database` });
          }

          sendEmail(clientId, `Power times (${times}) sent to client ${clientId} and saved in database`);
          res.json({ message: `Power times (${times}) sent to client ${clientId} and saved in database` });
        } catch (dbError) {
          console.error('Error saving power times:', dbError);
          res.status(500).json({ message: 'Message sent but failed to save in database', error: dbError.message });
        }
      });
    } catch (wsError) {
      console.error('Error handling WebSocket communication:', wsError);
      res.status(500).json({ message: 'Internal WebSocket error', error: wsError.message });
    }
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});





// Route to perform master restart on all connected clients
app.post('/VIDEO_IMPRESSION', (req, res) => {
  const clientIds = Object.keys(clients);
  const VIDEO_IMPRESSIONMessage = { type: 'VIDEO_IMPRESSION', message: 'VIDEO_IMPRESSION' };

  clientIds.forEach(clientId => {
    const ws = clients[clientId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(VIDEO_IMPRESSIONMessage));
      console.log(`VIDEO_IMPRESSION command sent to client ${clientId}`);
    }
  });

  // Send an email after master restart command
  sendEmail('VIDEO_IMPRESSION', 'The VIDEO_IMPRESSION command has been sent to all connected clients.');

  res.json({ message: 'VIDEO_IMPRESSION command sent to all connected clients' });
});


// Schedule the master-restart every minute
setInterval(() => {
  const clientIds = Object.keys(clients);
  const VIDEO_IMPRESSIONMessage = { type: 'VIDEO_IMPRESSION', message: 'VIDEO_IMPRESSION' };

  clientIds.forEach(clientId => {
    const ws = clients[clientId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(VIDEO_IMPRESSIONMessage));
      console.log(`VIDEO_IMPRESSION command sent to client ${clientId}`);
    }
  });

  console.log('Scheduled VIDEO_IMPRESSION command sent to all connected clients');
}, 600000); // 3600000 milliseconds = 1 hour









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
