const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const cors = require('cors');
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


// Use CORS
app.use(cors());  // Allow all origins, or specify as needed
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

    // ws.on('message', async (message) => {
    //   console.log(`Received message: ${message}`);

    //   let data;
    //   try {
    //     // Parse incoming message
    //     data = JSON.parse(message);
    //   } catch (error) {
    //     console.error(`Failed to parse message: ${error.message}`);
    //     return; // Exit if the message isn't valid JSON
    //   }

    //   const dateTime = new Date().toISOString(); // ISO format for consistency

    //   if (data.type === 'network') {
    //     try {
    //       const query = `
    //         INSERT INTO network_statuses (client_name, status, updated_at)
    //         VALUES ($1, $2, $3)
    //         ON CONFLICT (client_name) 
    //         DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;
    //       `;
    //       await pool.query(query, [data.clientId, data.status, dateTime]);
    //       console.log(`Network status updated for client ${data.clientId}.`);
    //     } catch (error) {
    //       console.error('Failed to update network status:', error);
    //     }
    //   } else if (data.type === 'Device_Config') {
    //     console.log('Device configuration data received:', data);

    //     try {
    //       const query = `
    //         INSERT INTO device_configs (client_name, ram_total, ram_used, storage_total, storage_used, resolution, downstream_bandwidth, upstream_bandwidth, manufacturer, model, os_version, wifi_enabled, wifi_mac_address, wifi_network_ssid, wifi_signal_strength_dbm, android_id, IfSecondScreenIsPresentOnDevice, updated_at)
    //         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    //         ON CONFLICT (client_name) DO UPDATE 
    //         SET ram_total = EXCLUDED.ram_total, ram_used = EXCLUDED.ram_used, storage_total = EXCLUDED.storage_total, storage_used = EXCLUDED.storage_used, resolution = EXCLUDED.resolution, downstream_bandwidth = EXCLUDED.downstream_bandwidth, upstream_bandwidth = EXCLUDED.upstream_bandwidth, manufacturer = EXCLUDED.manufacturer, model = EXCLUDED.model, os_version = EXCLUDED.os_version, wifi_enabled = EXCLUDED.wifi_enabled, wifi_mac_address = EXCLUDED.wifi_mac_address, wifi_network_ssid = EXCLUDED.wifi_network_ssid, wifi_signal_strength_dbm = EXCLUDED.wifi_signal_strength_dbm, android_id = EXCLUDED.android_id, IfSecondScreenIsPresentOnDevice = EXCLUDED.IfSecondScreenIsPresentOnDevice, updated_at = EXCLUDED.updated_at;
    //       `;
    //       await pool.query(query, [
    //         data.clientId,
    //         data.ram_total,
    //         data.ram_used,
    //         data.storage_total,
    //         data.storage_used,
    //         data['Screen-resolution'],
    //         data.downstream_bandwidth,
    //         data.upstream_bandwidth,
    //         data.manufacturer,
    //         data.model,
    //         data.os_version,
    //         data.wifiEnabled,
    //         data.wifiMacAddress,
    //         data.wifiNetworkSSID,
    //         data.wifiSignalStrengthdBm,
    //         data.androidId,
    //         data.IfSecondScreenIsPresentOnDevice,
    //         dateTime,
    //       ]);

    //       console.log(`Device configuration updated in database for client ${data.clientId} at ${dateTime}`);
    //     } catch (error) {
    //       console.error('Failed to update device configuration in database:', error);
    //     }
    //   } else if (data.type === 'Screenshot') {
    //     try {
    //       const query = `
    //         INSERT INTO screenshots (id, type, filename, image_url, size)
    //         VALUES ($1, $2, $3, $4, $5)
    //         ON CONFLICT (id) 
    //         DO UPDATE SET type = EXCLUDED.type, filename = EXCLUDED.filename, image_url = EXCLUDED.image_url, size = EXCLUDED.size;
    //       `;
    //       await pool.query(query, [
    //         data.id || data.Id,
    //         data.type,
    //         data.filename,
    //         data.imageUrl,
    //         data.size,
    //       ]);
    //       console.log(`Screenshot data saved for ID ${data.id || data.Id}.`);
    //     } catch (error) {
    //       console.error('Failed to save Screenshot data:', error);
    //     }
    //   } else if (data.type === 'Screenshot2') {
    //     try {
    //       const query = `
    //         INSERT INTO screenshots (id, filename2, image_url2, size2)
    //         VALUES ($1, $2, $3, $4)
    //         ON CONFLICT (id) 
    //         DO UPDATE SET filename2 = EXCLUDED.filename2, image_url2 = EXCLUDED.image_url2, size2 = EXCLUDED.size2;
    //       `;
    //       await pool.query(query, [
    //         data.id || data.Id,
    //         data.filename2,
    //         data.imageUrl2,
    //         data.size2,
    //       ]);
    //       console.log(`Screenshot2 data saved for ID ${data.id || data.Id}.`);
    //     } catch (error) {
    //       console.error('Failed to save Screenshot2 data:', error);
    //     }
    //   } else if (data.type === 'video_impression') {
    //     try {
    //       // Ensure necessary fields are present and valid
    //       if (!data.video_id || !data.screen_id || !data.device_id || !data.name || typeof data.count !== 'number' || typeof data.duration !== 'number') {
    //         throw new Error('Missing required fields or invalid data types');
    //       }

    //       // Convert the timestamp and uploaded_time_timestamp from milliseconds to seconds
    //       const timestampInSeconds = Math.floor(data.timestamp / 1000);
    //       const uploadedTimeInSeconds = Math.floor((data.uploaded_time_timestamp || Date.now()) / 1000);

    //       // SQL query with TO_TIMESTAMP to convert the Unix timestamp to a valid PostgreSQL timestamp
    //       const query = `
    //         INSERT INTO video_impressions (type, video_id, screen_id, device_id, name, count, duration, "timestamp", uploaded_time_timestamp)
    //         VALUES ($1, $2, $3, $4, $5, $6, $7, TO_TIMESTAMP($8), TO_TIMESTAMP($9))
    //       `;

    //       // Execute the query
    //       await pool.query(query, [
    //         data.type,
    //         data.video_id,
    //         data.screen_id,
    //         data.device_id,
    //         data.name,
    //         data.count,
    //         data.duration,
    //         timestampInSeconds,
    //         uploadedTimeInSeconds,
    //       ]);

    //       console.log(`Video impression data saved for video ID ${data.video_id}.`);
    //       // Send success response

    //     } catch (error) {
    //       const errorMessage = `Failed to save video impression data: ${error.message}`;
    //       console.error(errorMessage);

    //       // Log the exact error response being sent to the client
    //       console.log('Sending error response:', JSON.stringify({ status: 'error', message: errorMessage }));


    //     }
    //   } else {
    //     console.log(`Unknown message type received: ${data.type}`);
    //   }
    // });





    // ws.on('message', async (message) => {
    //   console.log(`[${new Date().toISOString()}] Received message: ${message}`);

    //   let data;
    //   try {
    //     // Parse incoming message
    //     data = JSON.parse(message);
    //     console.log(`[${new Date().toISOString()}] Message successfully parsed:`, data);
    //   } catch (error) {
    //     console.error(`[${new Date().toISOString()}] Failed to parse message: ${error.message}`);
    //     return; // Exit if the message isn't valid JSON
    //   }

    //   const dateTime = new Date().toISOString(); // ISO format for consistency

    //   if (data.type === 'network') {
    //     console.log(`[${new Date().toISOString()}] Processing network status for client: ${data.clientId}`);
    //     try {
    //       const query = `
    //         INSERT INTO network_statuses (client_name, status, updated_at)
    //         VALUES ($1, $2, $3)
    //         ON CONFLICT (client_name) 
    //         DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;
    //       `;
    //       await pool.query(query, [data.clientId, data.status, dateTime]);
    //       console.log(`[${new Date().toISOString()}] Network status updated for client ${data.clientId}.`);
    //     } catch (error) {
    //       console.error(`[${new Date().toISOString()}] Failed to update network status: ${error.message}`);
    //     }
    //   } else if (data.type === 'Device_Config') {
    //     console.log(`[${new Date().toISOString()}] Processing device configuration for client: ${data.clientId}`);
    //     try {
    //       const query = `
    //         INSERT INTO device_configs (client_name, ram_total, ram_used, storage_total, storage_used, resolution, downstream_bandwidth, upstream_bandwidth, manufacturer, model, os_version, wifi_enabled, wifi_mac_address, wifi_network_ssid, wifi_signal_strength_dbm, android_id, IfSecondScreenIsPresentOnDevice, updated_at)
    //         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    //         ON CONFLICT (client_name) DO UPDATE 
    //         SET ram_total = EXCLUDED.ram_total, ram_used = EXCLUDED.ram_used, storage_total = EXCLUDED.storage_total, storage_used = EXCLUDED.storage_used, resolution = EXCLUDED.resolution, downstream_bandwidth = EXCLUDED.downstream_bandwidth, upstream_bandwidth = EXCLUDED.upstream_bandwidth, manufacturer = EXCLUDED.manufacturer, model = EXCLUDED.model, os_version = EXCLUDED.os_version, wifi_enabled = EXCLUDED.wifi_enabled, wifi_mac_address = EXCLUDED.wifi_mac_address, wifi_network_ssid = EXCLUDED.wifi_network_ssid, wifi_signal_strength_dbm = EXCLUDED.wifi_signal_strength_dbm, android_id = EXCLUDED.android_id, IfSecondScreenIsPresentOnDevice = EXCLUDED.IfSecondScreenIsPresentOnDevice, updated_at = EXCLUDED.updated_at;
    //       `;
    //       await pool.query(query, [
    //         data.clientId,
    //         data.ram_total,
    //         data.ram_used,
    //         data.storage_total,
    //         data.storage_used,
    //         data['Screen-resolution'],
    //         data.downstream_bandwidth,
    //         data.upstream_bandwidth,
    //         data.manufacturer,
    //         data.model,
    //         data.os_version,
    //         data.wifiEnabled,
    //         data.wifiMacAddress,
    //         data.wifiNetworkSSID,
    //         data.wifiSignalStrengthdBm,
    //         data.androidId,
    //         data.IfSecondScreenIsPresentOnDevice,
    //         dateTime,
    //       ]);
    //       console.log(`[${new Date().toISOString()}] Device configuration updated for client ${data.clientId}.`);
    //     } catch (error) {
    //       console.error(`[${new Date().toISOString()}] Failed to update device configuration: ${error.message}`);
    //     }
    //   } else if (data.type === 'Screenshot') {
    //     console.log(`[${new Date().toISOString()}] Processing screenshot data for ID: ${data.id || data.Id}`);
    //     try {
    //       const query = `
    //         INSERT INTO screenshots (id, type, filename, image_url, size)
    //         VALUES ($1, $2, $3, $4, $5)
    //         ON CONFLICT (id) 
    //         DO UPDATE SET type = EXCLUDED.type, filename = EXCLUDED.filename, image_url = EXCLUDED.image_url, size = EXCLUDED.size;
    //       `;
    //       await pool.query(query, [
    //         data.id || data.Id,
    //         data.type,
    //         data.filename,
    //         data.imageUrl,
    //         data.size,
    //       ]);
    //       console.log(`[${new Date().toISOString()}] Screenshot data saved for ID ${data.id || data.Id}.`);
    //     } catch (error) {
    //       console.error(`[${new Date().toISOString()}] Failed to save screenshot data: ${error.message}`);
    //     }
    //   } else if (data.type === 'Screenshot2') {
    //     console.log(`[${new Date().toISOString()}] Processing secondary screenshot data for ID: ${data.id || data.Id}`);
    //     try {
    //       const query = `
    //         INSERT INTO screenshots (id, filename2, image_url2, size2)
    //         VALUES ($1, $2, $3, $4)
    //         ON CONFLICT (id) 
    //         DO UPDATE SET filename2 = EXCLUDED.filename2, image_url2 = EXCLUDED.image_url2, size2 = EXCLUDED.size2;
    //       `;
    //       await pool.query(query, [
    //         data.id || data.Id,
    //         data.filename2,
    //         data.imageUrl2,
    //         data.size2,
    //       ]);
    //       console.log(`[${new Date().toISOString()}] Screenshot2 data saved for ID ${data.id || data.Id}.`);
    //     } catch (error) {
    //       console.error(`[${new Date().toISOString()}] Failed to save Screenshot2 data: ${error.message}`);
    //     }
    //   } else if (data.type === 'video_impression') {
    //     console.log(`[${new Date().toISOString()}] Processing video impression data for video ID: ${data.video_id}`);
    //     try {
    //       if (!data.video_id || !data.screen_id || !data.device_id || !data.name || typeof data.count !== 'number' || typeof data.duration !== 'number') {
    //         throw new Error('Missing required fields or invalid data types');
    //       }

    //       const timestampInSeconds = Math.floor(data.timestamp / 1000);
    //       const uploadedTimeInSeconds = Math.floor((data.uploaded_time_timestamp || Date.now()) / 1000);

    //       const query = `
    //         INSERT INTO video_impressions (type, video_id, screen_id, device_id, name, count, duration, "timestamp", uploaded_time_timestamp)
    //         VALUES ($1, $2, $3, $4, $5, $6, $7, TO_TIMESTAMP($8), TO_TIMESTAMP($9));
    //       `;
    //       await pool.query(query, [
    //         data.type,
    //         data.video_id,
    //         data.screen_id,
    //         data.device_id,
    //         data.name,
    //         data.count,
    //         data.duration,
    //         timestampInSeconds,
    //         uploadedTimeInSeconds,
    //       ]);

    //       console.log(`[${new Date().toISOString()}] Video impression data saved for video ID ${data.video_id}.`);
    //     } catch (error) {
    //       const errorMessage = `Failed to save video impression data: ${error.message}`;
    //       console.error(`[${new Date().toISOString()}] ${errorMessage}`);
    //     }
    //   } else {
    //     console.log(`[${new Date().toISOString()}] Unknown for ${data.clientId} message type received: ${data.type}`);
    //   }
    // });







    // ws.on('message', async (message) => {
    //   console.log(`[${new Date().toISOString()}] Received message: ${message}`);

    //   let data;
    //   try {
    //     // Parse incoming message
    //     data = JSON.parse(message);
    //     console.log(`[${new Date().toISOString()}] Message successfully parsed:`, data);
    //   } catch (error) {
    //     console.error(`[${new Date().toISOString()}] Failed to parse message: ${error.message}`);
    //     return; // Exit if the message isn't valid JSON
    //   }

    //   const dateTime = new Date().toISOString(); // ISO format for consistency

    //   switch (data.type) {
    //     case 'network':
    //       console.log(`[${new Date().toISOString()}] Processing network status for client: ${data.clientId}`);
    //       try {
    //         const query = `
    //           INSERT INTO network_statuses (client_name, status, updated_at)
    //           VALUES ($1, $2, $3)
    //           ON CONFLICT (client_name) 
    //           DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;
    //         `;
    //         await pool.query(query, [data.clientId, data.status, dateTime]);
    //         console.log(`[${new Date().toISOString()}] Network status updated for client ${data.clientId}.`);
    //       } catch (error) {
    //         console.error(`[${new Date().toISOString()}] Failed to update network status: ${error.message}`);
    //       }
    //       break;

    //     case 'Device_Config':
    //       console.log(`[${new Date().toISOString()}] Processing device configuration for client: ${data.clientId}`);
    //       try {
    //       await pool.query(
    //         'INSERT INTO device_configs (client_name, ram_total, ram_used, storage_total, storage_used, resolution, downstream_bandwidth, upstream_bandwidth, manufacturer, model, os_version, wifi_enabled, wifi_mac_address, wifi_network_ssid, wifi_signal_strength_dbm, android_id, IfSecondScreenIsPresentOnDevice, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) ON CONFLICT (client_name) DO UPDATE SET ram_total = EXCLUDED.ram_total, ram_used = EXCLUDED.ram_used, storage_total = EXCLUDED.storage_total, storage_used = EXCLUDED.storage_used, resolution = EXCLUDED.resolution, downstream_bandwidth = EXCLUDED.downstream_bandwidth, upstream_bandwidth = EXCLUDED.upstream_bandwidth, manufacturer = EXCLUDED.manufacturer, model = EXCLUDED.model, os_version = EXCLUDED.os_version, wifi_enabled = EXCLUDED.wifi_enabled, wifi_mac_address = EXCLUDED.wifi_mac_address, wifi_network_ssid = EXCLUDED.wifi_network_ssid, wifi_signal_strength_dbm = EXCLUDED.wifi_signal_strength_dbm, android_id = EXCLUDED.android_id, IfSecondScreenIsPresentOnDevice = EXCLUDED.IfSecondScreenIsPresentOnDevice, updated_at = EXCLUDED.updated_at',
    //         [
    //           clientId,
    //           data.ram_total,
    //           data.ram_used,
    //           data.storage_total,
    //           data.storage_used,
    //           data['Screen-resolution'],
    //           data.downstream_bandwidth,
    //           data.upstream_bandwidth,
    //           data.manufacturer,
    //           data.model,
    //           data.os_version,
    //           data.wifiEnabled,
    //           data.wifiMacAddress,
    //           data.wifiNetworkSSID,
    //           data.wifiSignalStrengthdBm,
    //           data.androidId,
    //           data.IfSecondScreenIsPresentOnDevice, // Updated field as integer
    //           dateTime,
    //         ]
    //       );

    //       console.log(`Device configuration updated in database for client ${clientId} at ${dateTime}`);
    //     } catch (error) {
    //       console.error(`Failed to update device configuration in database:`, error);
    //     }
    //       break;

    //     case 'Screenshot':
    //       console.log(`[${new Date().toISOString()}] Processing screenshot data for ID: ${data.id || data.Id}`);
    //       try {
    //         const query = `
    //           INSERT INTO screenshots (id, type, filename, image_url, size)
    //           VALUES ($1, $2, $3, $4, $5)
    //           ON CONFLICT (id) 
    //           DO UPDATE SET type = EXCLUDED.type, filename = EXCLUDED.filename, image_url = EXCLUDED.image_url, size = EXCLUDED.size;
    //         `;
    //         await pool.query(query, [
    //           data.id || data.Id,
    //           data.type,
    //           data.filename,
    //           data.imageUrl,
    //           data.size,
    //         ]);
    //         console.log(`[${new Date().toISOString()}] Screenshot data saved for ID ${data.id || data.Id}.`);
    //       } catch (error) {
    //         console.error(`[${new Date().toISOString()}] Failed to save screenshot data: ${error.message}`);
    //       }
    //       break;

    //     case 'Screenshot2':
    //       console.log(`[${new Date().toISOString()}] Processing secondary screenshot data for ID: ${data.id || data.Id}`);
    //       try {
    //         const query = `
    //           INSERT INTO screenshots (id, filename2, image_url2, size2)
    //           VALUES ($1, $2, $3, $4)
    //           ON CONFLICT (id) 
    //           DO UPDATE SET filename2 = EXCLUDED.filename2, image_url2 = EXCLUDED.image_url2, size2 = EXCLUDED.size2;
    //         `;
    //         await pool.query(query, [
    //           data.id || data.Id,
    //           data.filename2,
    //           data.imageUrl2,
    //           data.size2,
    //         ]);
    //         console.log(`[${new Date().toISOString()}] Screenshot2 data saved for ID ${data.id || data.Id}.`);
    //       } catch (error) {
    //         console.error(`[${new Date().toISOString()}] Failed to save Screenshot2 data: ${error.message}`);
    //       }
    //       break;

    //     case 'video_impression':
    //       console.log(`[${new Date().toISOString()}] Processing video impression data for video ID: ${data.video_id}`);
    //       try {
    //         if (!data.video_id || !data.screen_id || !data.device_id || !data.name || typeof data.count !== 'number' || typeof data.duration !== 'number') {
    //           throw new Error('Missing required fields or invalid data types');
    //         }

    //         const timestampInSeconds = Math.floor(data.timestamp / 1000);
    //         const uploadedTimeInSeconds = Math.floor((data.uploaded_time_timestamp || Date.now()) / 1000);

    //         const query = `
    //           INSERT INTO video_impressions (type, video_id, screen_id, device_id, name, count, duration, "timestamp", uploaded_time_timestamp)
    //           VALUES ($1, $2, $3, $4, $5, $6, $7, TO_TIMESTAMP($8), TO_TIMESTAMP($9));
    //         `;
    //         await pool.query(query, [
    //           data.type,
    //           data.video_id,
    //           data.screen_id,
    //           data.device_id,
    //           data.name,
    //           data.count,
    //           data.duration,
    //           timestampInSeconds,
    //           uploadedTimeInSeconds,
    //         ]);

    //         console.log(`[${new Date().toISOString()}] Video impression data saved for video ID ${data.video_id}.`);
    //       } catch (error) {
    //         console.error(`[${new Date().toISOString()}] Failed to save video impression data: ${error.message}`);
    //       }
    //       break;

    //     default:
    //       console.log(`[${new Date().toISOString()}] Unknown message type received: ${data.type}`);
    //   }
    // });



    ws.on('message', async (message) => {
        console.log(`Received message: ${message}`);

        let data;
        try {
            // Parse incoming message
            data = JSON.parse(message);
        } catch (error) {
            console.error(`Failed to parse message: ${error.message}`);
            return; // Exit if the message isn't valid JSON
        }

        const dateTime = new Date().toISOString(); // ISO format for consistency

        if (data.type === 'network') {
            try {
                const query = `
        INSERT INTO network_statuses (client_name, status, updated_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (client_name) 
        DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;
      `;
                await pool.query(query, [data.clientId, data.status, dateTime]);
                console.log(`Network status updated for client ${data.clientId}.`);
            } catch (error) {
                console.error('Failed to update network status:', error);
            }
        } else if (data.type === 'Device_Config') {
     
      console.log('Device configuration data received:', data);

      console.log('Preparing to insert/update device configuration for client:', clientId);
  
      // Printing all values before inserting into the database
      console.log('Device Config Data:');
      console.log('Client ID:', clientId);
      console.log('RAM Total:', data.ram_total);
      console.log('RAM Used:', data.ram_used);
      console.log('Storage Total:', data.storage_total);
      console.log('Storage Used:', data.storage_used);
      console.log('Screen Resolution:', data['Screen-resolution']);
      console.log('Downstream Bandwidth:', data.downstream_bandwidth);
      console.log('Upstream Bandwidth:', data.upstream_bandwidth);
      console.log('Manufacturer:', data.manufacturer);
      console.log('Model:', data.model);
      console.log('OS Version:', data.os_version);
      console.log('WiFi Enabled:', data.wifiEnabled);
      console.log('WiFi MAC Address:', data.wifiMacAddress);
      console.log('WiFi Network SSID:', data.wifiNetworkSSID);
      console.log('WiFi Signal Strength (dBm):', data.wifiSignalStrengthdBm);
      console.log('Android ID:', data.androidId);
      console.log('Second Screen Present:', data.IfSecondScreenIsPresentOnDevice);
      console.log('System Volume:', data.SystemVolumeManager);
      console.log('YouTube Volume:', data.YoutubeVolumeManager);
      console.log('ExoPlayer Volume:', data.ExoPlayerVolumeManager);
      console.log('Updated At:', dateTime);
  
      try {
          console.log('Executing database query...');
  
          await pool.query(
              `INSERT INTO device_configs (
                  client_name, ram_total, ram_used, storage_total, storage_used, resolution, 
                  downstream_bandwidth, upstream_bandwidth, manufacturer, model, os_version, 
                  wifi_enabled, wifi_mac_address, wifi_network_ssid, wifi_signal_strength_dbm, 
                  android_id, IfSecondScreenIsPresentOnDevice, SystemVolumeManager, 
                  YoutubeVolumeManager, ExoPlayerVolumeManager, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
                  $16, $17, $18, $19, $20, $21
              ) 
              ON CONFLICT (client_name) 
              DO UPDATE SET 
                  ram_total = EXCLUDED.ram_total, 
                  ram_used = EXCLUDED.ram_used, 
                  storage_total = EXCLUDED.storage_total, 
                  storage_used = EXCLUDED.storage_used, 
                  resolution = EXCLUDED.resolution, 
                  downstream_bandwidth = EXCLUDED.downstream_bandwidth, 
                  upstream_bandwidth = EXCLUDED.upstream_bandwidth, 
                  manufacturer = EXCLUDED.manufacturer, 
                  model = EXCLUDED.model, 
                  os_version = EXCLUDED.os_version, 
                  wifi_enabled = EXCLUDED.wifi_enabled, 
                  wifi_mac_address = EXCLUDED.wifi_mac_address, 
                  wifi_network_ssid = EXCLUDED.wifi_network_ssid, 
                  wifi_signal_strength_dbm = EXCLUDED.wifi_signal_strength_dbm, 
                  android_id = EXCLUDED.android_id, 
                  IfSecondScreenIsPresentOnDevice = EXCLUDED.IfSecondScreenIsPresentOnDevice, 
                  SystemVolumeManager = EXCLUDED.SystemVolumeManager, 
                  YoutubeVolumeManager = EXCLUDED.YoutubeVolumeManager, 
                  ExoPlayerVolumeManager = EXCLUDED.ExoPlayerVolumeManager, 
                  updated_at = EXCLUDED.updated_at`,
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
                  data.IfSecondScreenIsPresentOnDevice,
                  data.SystemVolumeManager,
                  data.YoutubeVolumeManager,
                  data.ExoPlayerVolumeManager,
                  dateTime,
              ]
          );
  
          console.log(`✅ Successfully updated device configuration in database for client ${clientId} at ${dateTime}`);
      } catch (error) {
        console.error(`Failed to update device configuration in database:`, error);
      }
} else if (data.type === 'Screenshot') {
            try {
                const istTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

                const query = `
          INSERT INTO screenshots (id, type, filename, image_url, size)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) 
          DO UPDATE SET type = EXCLUDED.type, filename = EXCLUDED.filename, image_url = EXCLUDED.image_url, size = EXCLUDED.size;
        `;
                await pool.query(query, [
                    data.id || data.Id,
                    data.type,
                    data.filename,
                    data.imageUrl,
                    data.size,
                ]);

                // Insert data into the new table (no conflict handling, always inserts)
                const logQuery = `
          INSERT INTO screenshots_log (id, type, filename, image_url, size, created_at)
          VALUES ($1, $2, $3, $4, $5, $6);
        `;
                await pool.query(logQuery, [
                    data.id || data.Id,
                    data.type,
                    data.filename,
                    data.imageUrl,
                    data.size,
                    istTime,
                ]);

                console.log(`Screenshot data saved for ID ${data.id || data.Id}.`);
            } catch (error) {
                console.error('Failed to save Screenshot data:', error);
            }
        } else if (data.type === 'Screenshot2') {
            try {
                const istTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

                const query = `
          INSERT INTO screenshots (id, filename2, image_url2, size2)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) 
          DO UPDATE SET filename2 = EXCLUDED.filename2, image_url2 = EXCLUDED.image_url2, size2 = EXCLUDED.size2;
        `;
                await pool.query(query, [
                    data.id || data.Id,
                    data.filename2,
                    data.imageUrl2,
                    data.size2,
                ]);

                // Insert into log table
                const logQuery = `
          INSERT INTO screenshots_log (id, filename, image_url, size, created_at)
          VALUES ($1, $2, $3, $4, $5);
        `;
                await pool.query(logQuery, [
                    data.id || data.Id,
                    data.filename2,
                    data.imageUrl2,
                    data.size2,
                    istTime,
                ]);

                console.log(`Screenshot2 data saved for ID ${data.id || data.Id}.`);
            } catch (error) {
                console.error('Failed to save Screenshot2 data:', error);
            }
        }

        else if (data.type === 'video_impression') {
            console.log('[INFO] Processing "video_impression" message.');

            try {
                // Validate required fields and types
                const requiredFields = ['video_id', 'screen_id', 'device_id', 'name', 'count', 'duration', 'video_tag'];
                for (const field of requiredFields) {
                    if (!data[field] || (typeof data[field] !== 'number' && typeof data[field] !== 'string')) {
                        throw new Error(`Missing or invalid field: ${field}`);
                    }
                }

                const IST_OFFSET_SECONDS = 19800; // +5:30 offset in seconds
                const timestampInSeconds = Math.floor(data.timestamp / 1000) + IST_OFFSET_SECONDS;
                const uploadedTimeInSeconds = Math.floor((data.uploaded_time_timestamp || Date.now()) / 1000) + IST_OFFSET_SECONDS;
                const uploadedDate = new Date(uploadedTimeInSeconds * 1000).toISOString().split('T')[0]; // Extract the date in YYYY-MM-DD format

                // Check for existing entry in the main table
                const checkQuery = `
        SELECT id, count 
        FROM video_impressions 
        WHERE uploaded_date = $1 AND video_tag = $2 AND screen_id = $3
    `;
                const checkParams = [uploadedDate, data.video_tag, data.screen_id]; // Add the third parameter
                const result = await pool.query(checkQuery, checkParams);

                if (result.rows.length > 0) {
                    // Entry exists; update the count
                    const existingEntry = result.rows[0];
                    const newCount = existingEntry.count + data.count;

                    const updateQuery = `
                UPDATE video_impressions 
                SET count = $1, duration = $2 
                WHERE id = $3
            `;
                    const updateParams = [newCount, data.duration, existingEntry.id];
                    await pool.query(updateQuery, updateParams);

                    console.log(`[SUCCESS] Updated video impression data for video_tag: ${data.video_tag}, uploaded_date: ${uploadedDate}.`);
                    ws.send(JSON.stringify({
                        status: 'success',
                        message: 'Data saved successfully.',
                        type: 'VIDEO_IMPRESSION',
                        video_id: data.video_id
                    }));


                } else {
                    // Entry does not exist; insert a new record in the main table
                    const insertQuery = `
                INSERT INTO video_impressions (
                    type, video_id, screen_id, device_id, name, count, duration, video_tag, "timestamp", uploaded_time_timestamp, uploaded_date
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TO_TIMESTAMP($9), TO_TIMESTAMP($10), $11)
            `;
                    const insertParams = [
                        data.type,
                        data.video_id,
                        data.screen_id,
                        data.device_id,
                        data.name,
                        data.count,
                        data.duration,
                        data.video_tag,
                        timestampInSeconds,
                        uploadedTimeInSeconds,
                        uploadedDate,
                    ];
                    await pool.query(insertQuery, insertParams);

                    console.log(`[SUCCESS] Video impression data saved for video ID: ${data.video_id}.`);
                    ws.send(JSON.stringify({
                        status: 'success',
                        message: 'Data saved successfully.',
                        type: 'VIDEO_IMPRESSION',    
                        video_id: data.video_id
                    }));

                }

                // Insert into the new table (video_impressions_log)
                const logInsertQuery = `
            INSERT INTO video_impressions_log (
                type, video_id, screen_id, device_id, name, count, duration, video_tag, timestamp, uploaded_time_timestamp, uploaded_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TO_TIMESTAMP($9), TO_TIMESTAMP($10), $11)
        `;
                const logInsertParams = [
                    data.type,
                    data.video_id,
                    data.screen_id,
                    data.device_id,
                    data.name,
                    data.count,
                    data.duration,
                    data.video_tag,
                    timestampInSeconds,
                    uploadedTimeInSeconds,
                    uploadedDate,
                ];
                await pool.query(logInsertQuery, logInsertParams);

                console.log(`[SUCCESS] Video impression log entry saved for video ID: ${data.video_id}.`);

            } catch (error) {
                const errorMessage = `Failed to save video impression data: ${error.message}`;
                console.error('[ERROR]', errorMessage);

                // ws.send(JSON.stringify({ status: 'error', message: errorMessage }));
            }
        }

        else if (data.type === 'PEOPLE_IMPRESSION') {
            console.log('[INFO] Processing "PEOPLE_IMPRESSION" message.');

            try {
                // Convert timestamp to IST
                const IST_OFFSET_SECONDS = 19800;
                const timestampInSeconds = Math.floor(data.timestamp / 1000) + IST_OFFSET_SECONDS;
                const uploadedDate = new Date(timestampInSeconds * 1000).toISOString().split('T')[0];

                // Check if an entry for this screen and date already exists
                const checkQuery = `
              SELECT id, face_count, male_count, female_count, age
              FROM people_impressions 
              WHERE uploaded_date = $1 AND screen_id = $2
          `;
                const checkParams = [uploadedDate, data.screenId];
                const result = await pool.query(checkQuery, checkParams);

                if (result.rows.length > 0) {
                    const existingEntry = result.rows[0];

                    // Aggregate the counts
                    const newFaceCount = existingEntry.face_count + data.faceCount;
                    const newMaleCount = existingEntry.male_count + data.maleCount;
                    const newFemaleCount = existingEntry.female_count + data.femaleCount;
                    const newAge = Math.round((existingEntry.age + data.age) / 2); // Average age calculation

                    // Update the existing record
                    const updateQuery = `
                  UPDATE people_impressions 
                  SET face_count = $1, male_count = $2, female_count = $3, age = $4
                  WHERE id = $5
              `;
                    const updateParams = [newFaceCount, newMaleCount, newFemaleCount, newAge, existingEntry.id];
                    await pool.query(updateQuery, updateParams);

                    console.log(`[SUCCESS] Updated people impression data for screen ID: ${data.screenId}, uploaded_date: ${uploadedDate}.`);
                    // ws.send(JSON.stringify({ status: 'success', message: 'Data updated successfully.' }));
                } else {
                    // Insert a new record
                    const insertQuery = `
                  INSERT INTO people_impressions (screen_id, face_count, male_count, female_count, age, timestamp, uploaded_date)
                  VALUES ($1, $2, $3, $4, $5, TO_TIMESTAMP($6), $7)
              `;
                    const insertParams = [
                        data.screenId,
                        data.faceCount,
                        data.maleCount,
                        data.femaleCount,
                        data.age,
                        timestampInSeconds,
                        uploadedDate
                    ];
                    await pool.query(insertQuery, insertParams);

                    console.log(`[SUCCESS] People impression data saved for screen ID: ${data.screenId}.`);
                    // ws.send(JSON.stringify({ status: 'success', message: 'Data saved successfully.' }));
                }

                // Insert into log table
                const logInsertQuery = `
              INSERT INTO people_impressions_log (screen_id, face_count, male_count, female_count, age, timestamp, uploaded_date)
              VALUES ($1, $2, $3, $4, $5, TO_TIMESTAMP($6), $7)
          `;
                const logInsertParams = [
                    data.screenId,
                    data.faceCount,
                    data.maleCount,
                    data.femaleCount,
                    data.age,
                    timestampInSeconds,
                    uploadedDate
                ];
                await pool.query(logInsertQuery, logInsertParams);

                console.log(`[SUCCESS] People impression log entry saved for screen ID: ${data.screenId}.`);

            } catch (error) {
                console.error(`[ERROR] Failed to save people impression data: ${error.message}`);
                // ws.send(JSON.stringify({ status: 'error', message: error.message }));
            }
        } else {
            console.log(`Unknown message type received: ${data.type}`);
        }
    });




    app.set('view engine', 'ejs'); // If using EJS
    app.use(express.static('public'));















    // app.get('/video-impressions', async (req, res) => {
    //   try {
    //     const result = await pool.query(`
    //       SELECT id, type, video_id, screen_id, device_id, name, count, duration, "timestamp", uploaded_time_timestamp, video_tag, uploaded_date
    //       FROM public.video_impressions
    //       ORDER BY uploaded_date DESC; -- Change DESC to ASC for ascending order
    //     `);

    //     res.render('video-impressions', { data: result.rows });
    //   } catch (err) {
    //     console.error('Error fetching data', err);
    //     res.status(500).send('Error fetching data');
    //   }
    // });









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


app.get('/video-impressions', async (req, res) => {
    try {
        console.log('Fetching video impressions data...'); // Log when the endpoint is hit

        const query = `
      SELECT 
        vi.id, 
        vi.type, 
        vi.video_id, 
        vi.screen_id, 
        vi.device_id, 
        vi.name, 
        vi.count, 
        vi.duration, 
        vi."timestamp", 
        vi.uploaded_time_timestamp, 
        vi.video_tag, 
        vi.uploaded_date,
        s.screenname,
        s.area,
        s.city,
        s.reach
      FROM 
        public.video_impressions AS vi
      LEFT JOIN 
        public.screen_proposal AS s
      ON 
        vi.screen_id = s.screenid  -- Cast both to compatible type
      ORDER BY 
        vi.uploaded_date DESC; -- Change DESC to ASC for ascending order
    `;

        console.log('Executing query:', query); // Log the query being executed
        const result = await pool.query(query);

        console.log('Data retrieved successfully:', result.rows.length, 'rows'); // Log the number of rows fetched

        res.render('video-impressions', { data: result.rows });
    } catch (err) {
        console.error('Error fetching data:', err); // Log the error details
        res.status(500).send('Error fetching data');
    }
});
app.get('/people-impressions', async (req, res) => {
    try {
        console.log('Fetching people impressions data...'); // Log when the endpoint is hit

        const query = `
      SELECT 
        pi.id, 
        pi.screen_id, 
        pi.face_count, 
        pi.male_count, 
        pi.female_count, 
        pi.age, 
        pi."timestamp", 
        pi.uploaded_date,
        s.screenname,
        s.area,
        s.city,
        s.reach
      FROM 
        public.people_impressions AS pi
      LEFT JOIN 
        public.screen_proposal AS s
      ON 
        pi.screen_id = s.screenid
      ORDER BY 
        pi.uploaded_date DESC;
    `;

        console.log('Executing query:', query); // Log the query being executed
        const result = await pool.query(query);

        console.log('Data retrieved successfully:', result.rows.length, 'rows'); // Log the number of rows fetched

        res.render('people-impressions', { data: result.rows });
    } catch (err) {
        console.error('Error fetching data:', err); // Log the error details
        res.status(500).send('Error fetching data');
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
        pass: "nait yiag ebyg cxwk",
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

app.post('/OLD_DEVICE_REBOOT/:id', (req, res) => {
    const clientId = req.params.id;
    const ws = clients[clientId];

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'OLD_DEVICE_REBOOT', message: 'OLD_DEVICE_REBOOT' }));
        sendEmail(clientId, 'OLD_DEVICE_REBOOT');
        res.json({ message: `OLD_DEVICE_REBOOT command sent to client ${clientId}` });
    } else {
        res.status(404).json({ message: `Client ${clientId} is not connected` });
    }
});





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




// Volume update command
app.post('/:volumeType/:id', (req, res) => {
  const clientId = req.params.id;
  const volumeType = req.params.volumeType; // MAIN_VOL_SEEKBAR, exoVolume, youTubeVolume
  const volume = req.body.volume; // Get volume from request body
  const ws = clients[clientId];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: volumeType, message: volume }));
    res.json({ message: `${volumeType} updated to ${volume} for client ${clientId}` });
  } else {
    res.status(404).json({ message: `Client ${clientId} is not connected` });
  }
});



// HIDE_SCREEN_ID command
app.post('/HIDE_SCREEN_ID/:id', (req, res) => {
    const clientId = req.params.id;
    const ws = clients[clientId];

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'HIDE_SCREEN_ID', message: 'HIDE_SCREEN_ID' }));
        sendEmail(clientId, 'HIDE_SCREEN_ID');
        res.json({ message: `HIDE_SCREEN_ID command sent to client ${clientId}` });
    } else {
        res.status(404).json({ message: `Client ${clientId} is not connected` });
    }
});





// SHOW_SCREEN_ID command
app.post('/SHOW_SCREEN_ID/:id', (req, res) => {
    const clientId = req.params.id;
    const ws = clients[clientId];

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'SHOW_SCREEN_ID', message: 'SHOW_SCREEN_ID' }));
        sendEmail(clientId, 'SHOW_SCREEN_ID');
        res.json({ message: `SHOW_SCREEN_ID command sent to client ${clientId}` });
    } else {
        res.status(404).json({ message: `Client ${clientId} is not connected` });
    }
});


// AD_VIDEOS_DLT command
app.post('/AD_VIDEOS_DLT/:id', (req, res) => {
    const clientId = req.params.id;
    const ws = clients[clientId];

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'AD_VIDEOS_DLT', message: 'AD_VIDEOS_DLT' }));
        sendEmail(clientId, 'AD_VIDEOS_DLT');
        res.json({ message: `AD_VIDEOS_DLT command sent to client ${clientId}` });
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
// app.post('/UPDATE_APP_SAKI/:id', (req, res) => {
//   const clientId = req.params.id;
//   const ws = clients[clientId];

//   if (ws && ws.readyState === WebSocket.OPEN) {
//     ws.send(JSON.stringify({ type: 'UPDATE_APP_SAKI', message: 'https://www.dropbox.com/scl/fi/n0a6rus2kj5b8qw3z9lkx/AekAdDisply_V_5_3_20Jan.apk?rlkey=0fba4ixdhj6tz6tk6um164efz&st=wmend7i8&raw=1' }));
//     sendEmail(clientId, 'Update App Saki');
//     res.json({ message: `UPDATE APP command sent to client ${clientId}` });
//   } else {
//     res.status(404).json({ message: `Client ${clientId} is not connected` });
//   }
// });

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





app.get('/BOTH_SCREENS_SCREENSORT/:id', (req, res) => {
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








app.post('/PEOPLE_IMPRESSION/:id', (req, res) => {
    const clientId = req.params.id;
    const ws = clients[clientId];

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PEOPLE_IMPRESSION', message: 'PEOPLE_IMPRESSION' }));
        sendEmail(clientId, 'PEOPLE_IMPRESSION');
        res.json({ message: `PEOPLE_IMPRESSION command sent to client ${clientId}` });
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


setInterval(async () => {
    try {
        console.log('Starting scheduled task for VIDEO_IMPRESSION...');

        const clientIds = Object.keys(clients);
        console.log(`Connected client IDs: ${clientIds.join(', ')}`);

        const VIDEO_IMPRESSION = { type: 'VIDEO_IMPRESSION', message: 'VIDEO_IMPRESSION' };

        // Database query to filter clients based on Wi-Fi SSID
        const query = `
      SELECT client_name
      FROM public.device_configs
      WHERE wifi_network_ssid = 'Version: 5.6 (VersionCode: 6)';
    `;

        console.log('Executing database query...');
        const result = await pool.query(query);

        const validClientNames = result.rows.map(row => row.client_name);
        console.log(`Filtered client names matching Wi-Fi SSID criteria: ${validClientNames.join(', ')}`);

        clientIds.forEach(clientId => {
            console.log(`Processing client: ${clientId}`);

            if (validClientNames.includes(clientId)) {
                const ws = clients[clientId];

                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(VIDEO_IMPRESSION));
                    console.log(`VIDEO_IMPRESSION command sent to client ${clientId}`);
                } else {
                    console.log(`Client ${clientId} WebSocket not open or unavailable`);
                }
            } else {
                console.log(`Client ${clientId} does not match the filter criteria`);
            }
        });

        console.log('Scheduled VIDEO_IMPRESSION command task complete');
    } catch (error) {
        console.error('Error querying database or sending commands:', error);
    }
}, 300000); // 5 minutes




// // // Schedule the VIDEO_IMPRESSION every minute
// setInterval(() => {
//   const clientIds = Object.keys(clients);
//   const restartMessage = { type: 'VIDEO_IMPRESSION', message: 'VIDEO_IMPRESSION' };

//   clientIds.forEach(clientId => {
//     const ws = clients[clientId];
//     if (ws && ws.readyState === WebSocket.OPEN) {
//       ws.send(JSON.stringify(restartMessage));
//       console.log(`Restart command sent to client ${clientId}`);
//     }
//   });

//   console.log('Scheduled VIDEO_IMPRESSION command sent to all connected clients');
// }, 300000); // 300000  milliseconds = 5 min




// // Schedule the BOTH_SCREENS_SCREENSORT every 3 hours
// setInterval(() => {
//   const clientIds = Object.keys(clients);
//   const BOTH_SCREENS_SCREENSORT = { type: 'BOTH_SCREENS_SCREENSORT', message: 'BOTH_SCREENS_SCREENSORT' };

//   clientIds.forEach(clientId => {
//     const ws = clients[clientId];
//     if (ws && ws.readyState === WebSocket.OPEN) {
//       ws.send(JSON.stringify(BOTH_SCREENS_SCREENSORT));
//       console.log(`BOTH_SCREENS_SCREENSORT command sent to client ${clientId}`);
//     }
//   });

//   console.log('Scheduled BOTH_SCREENS_SCREENSORT command sent to all connected clients');
// }, 10800000); // 10800000  milliseconds = 3 hours


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
// app.get('/UPDATE_APP_SAKI/:id', (req, res) => {
//   const clientId = req.params.id;
//   const ws = clients[clientId];

//   if (ws && ws.readyState === WebSocket.OPEN) {
//     ws.send(JSON.stringify({ type: 'UPDATE_APP_SAKI', message: 'dhvanil client' }));
//     sendEmail(clientId, 'UPDATE_APP_SAKI');
//     res.json({ message: `UPDATE APP command sent to client ${clientId}` });
//   } else {
//     res.status(404).json({ message: `Client ${clientId} is not connected` });
//   }
// });

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






// Update App Saki command
app.post('/UPDATE_APP_SAKI/:id', (req, res) => {
    const clientId = req.params.id;
    const ws = clients[clientId];

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'UPDATE_APP_SAKI', message: 'https://www.dropbox.com/scl/fi/k51fmr0r2vmrfap4m1itd/AekAdDisply_V_5_6_5Feb.apk?rlkey=lvbbhoqmzp5iiw44u6b348vzx&st=kwr5ukna&raw=1' }));
        sendEmail(clientId, 'Update App Saki');
        res.json({ message: `UPDATE APP command sent to client ${clientId}` });
    } else {
        res.status(404).json({ message: `Client ${clientId} is not connected` });
    }
});



app.post('/master-update', (req, res) => {
    const clientIds = Object.keys(clients);
    const updateMessage = { type: 'UPDATE_APP_SAKI', message: 'https://www.dropbox.com/scl/fi/tv6pebzqqwc8ict51jo58/AekAdDisply_V_5_5_28Jan.apk?rlkey=caeyljld0685yxu6fmtywzg6p&st=oqnvzqdc&raw=1' };

    clientIds.forEach(clientId => {
        const ws = clients[clientId];
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(updateMessage));
            console.log(`updateMessage command sent to client ${clientId}`);
        }
    });

    // Send an email after master updateMessage command
    sendEmail('Master updateMessage', 'The master updateMessage command has been sent to all connected clients.');

    res.json({ message: 'updateMessage command sent to all connected clients' });
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
        console.log("redirectPath", redirectPath);

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
