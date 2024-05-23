const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const sqlite3 = require("sqlite3").verbose(); // Import SQLite3
const db = new sqlite3.Database("data.db");
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// CORS middleware
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server for broadcasting
const broadcastWss = new WebSocket.Server({ noServer: true });
app.use('/public', express.static(path.join(__dirname, 'public')));

// WebSocket connection handler for broadcasting
broadcastWss.on("connection", (ws) => {
  console.log("WebSocket client connected to broadcast endpoint");
});

// Upgrade HTTP server to WebSocket for broadcast endpoint
server.on("upgrade", (request, socket, head) => {
  broadcastWss.handleUpgrade(request, socket, head, (ws) => {
    broadcastWss.emit("connection", ws, request);
  });
});

// Function to send data to WebSocket clients
const sendDataToWebSocket = (data) => {
  broadcastWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};
let sseClients = [];

const sendSSE = (data) => {
  
  sseClients.forEach((client) => {
    
    client.res.write(`event: data\n`);
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};
// POST endpoint to receive data
app.post("/data", (req, res) => {
  const eventData = req.body; // Assuming the data sent is in the request body
  const playerName = req.headers["player-name"]; // Assuming player name is sent in the request headers
  const playerid = req.headers["player-id"]; // Assuming player ID is sent in the request headers
  const cteam = req.headers["team"]; // Assuming player ID is sent in the request headers
  const teamno = req.headers["teamname"];
  let messageType = null;
  let messageData = null;

  // Check if eventData has 'me' or 'match_data'
  if ("me" in eventData) {
    const meData = eventData["me"];

    // Check if 'health' key exists in 'me' object
    if ("health" in meData) {
      messageType = "health";
      messageData = meData["health"];

    }
    
    // Check if 'abilities' key exists in 'me' object
    else if ("abilities" in meData) {
      messageType = "abilities";
      messageData = JSON.parse(meData["abilities"]);
    }
    // If neither 'health' nor 'abilities' exist, set the message type as 'me'
    else {
      messageType = "me";
      messageData = meData;
    }
  } else if ("match_data" in eventData) {
    messageType = "match_data";
    messageData = eventData["match_data"];
  }

  // Check if eventData has 'match_info'
  // Check if eventData has 'match_info'
  if ("match_info" in eventData) {
    const matchInfo = eventData["match_info"];

    // Check if "score" key exists in matchInfo
    if ("score" in matchInfo) {
      messageType = "score";
      messageData = JSON.parse(matchInfo["score"]);
    } else if ("round_number" in matchInfo) {
      messageType = "round_number";
      messageData = matchInfo["round_number"]; // Assign non-JSON data directly
    }
    // Check if 'round_phase' key exists in matchInfo
    else if ("round_phase" in matchInfo) {
      messageType = "round_phase";
      messageData = matchInfo["round_phase"]; // Assign non-JSON data directly
      

    } else if ("team" in matchInfo) {
      messageType = "team";
      messageData = matchInfo["team"];
    }
    // Iterate over scoreboard keys
    else {
      Object.keys(matchInfo).forEach((key) => {
        const scoreboardData = JSON.parse(matchInfo[key]);
        // Check if player_id matches the player ID from headers
        if (scoreboardData.player_id === playerid) {
          // Set messageType and messageData
          messageType = "match_info";
          messageData = scoreboardData;
        }
      });
    }
  }
  if ("game_info" in eventData) {
    const gameInfo = eventData["game_info"];
    if ("state" in gameInfo) {
      messageType = "game_info";
      messageData = gameInfo["state"];
    }
  }

  // Construct the data to be sent as JSON
  const dataToSend = {
    player: playerName,
    playerid: playerid,
    type: messageType,
    data: messageData,
    team: cteam,
    teamname: teamno,
  };
  console.log(dataToSend);
  sendSSE(dataToSend);
  if (messageData !== null || messageType !== null) {
    if (messageType == "match_info") {
      const {
        player_id,
        character,
        alive,
        shield,
        weapon,
        ult_points,
        ult_max,
        kills,
        deaths,
        assists,
        money,
        is_local,
        name,
        teammate,
      } = messageData;
      const team = cteam;
      const teamno = dataToSend.teamname; // Assuming teamno is where you store the team name
      const sql = `
        INSERT INTO player (player_id, character, alive, shield, weapon, ult_points, ult_max, kills, deaths, assists, money, is_local, team, name, teammate, teamname)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(player_id) DO UPDATE SET
        character = COALESCE(?, character),
        alive = COALESCE(?, alive),
        shield = COALESCE(?, shield),
        weapon = COALESCE(?, weapon),
        ult_points = COALESCE(?, ult_points),
        ult_max = COALESCE(?, ult_max),
        kills = COALESCE(?, kills),
        deaths = COALESCE(?, deaths),
        assists = COALESCE(?, assists),
        money = COALESCE(?, money),
        is_local = COALESCE(?, is_local),
        team = COALESCE(?, team),
        name = COALESCE(?, name),
        teammate = COALESCE(?, teammate),
        teamname = COALESCE(?, ?)
      `;
      // Execute the SQL statement
      db.run(sql, [
        player_id,
        character,
        alive,
        shield,
        weapon,
        ult_points,
        ult_max,
        kills,
        deaths,
        assists,
        money,
        is_local,
        team,
        name,
        teammate,
        teamno, // Add teamname parameter
        character,
        alive,
        shield,
        weapon,
        ult_points,
        ult_max,
        kills,
        deaths,
        assists,
        money,
        is_local,
        team,
        name,
        teammate,
        teamno, // Update teamname parameter
      ]);
    }
    
    
    if (messageType === "health") {
      const { playerid, data } = dataToSend;
      const sql = `
          UPDATE player 
          SET health = ?
          WHERE player_id = ?
      `;

      // Execute the SQL statement
      db.run(sql, [data, playerid]);
    }

    if (messageType === "abilities") {
      const { playerid, data } = dataToSend;
      const { C, E, Q, X } = data;
      const sql = `
        UPDATE player 
        SET C = ?,
            E = ?,
            Q = ?,
            X = ?
        WHERE player_id = ?
    `;

      // Execute the SQL statement
      db.run(sql, [C, E, Q, X, playerid]);
    }
    if (messageType === "round_phase" && messageData === "shopping") {
      const { playerid } = dataToSend;
      const sql = `
          UPDATE player 
          SET health = 100
          WHERE player_id = ?
      `;

      // Execute the SQL statement
      db.run(sql, [playerid]);
    }
    if (messageType === "game_info" && messageData === "WaitingToStart") {
      const deleteQuery = `DELETE FROM match`;
      db.run(deleteQuery, function(error) {
          if (error) {
              console.error("Error deleting rows:", error.message);
              return;
          }
          
          const insertQuery = `INSERT INTO match (roundnumber, team1, team2, typewin) VALUES (0, 0, 0, NULL)`;
          db.run(insertQuery, function(error) {
              if (error) {
                  console.error("Error inserting default values:", error.message);
                  return;
              }
              
              console.log("Table 'match' reset successfully.");
          });
      });
  }
  
  if (messageType === "score") {
    const roundNumber = calculateRoundNumber(messageData); // Assuming you have implemented calculateRoundNumber function
    const typeWin = dataToSend.team === "defense" ? "defense" : "attack";
    console.log(typeWin,dataToSend.team)
    const query = `
      INSERT INTO "match" (roundnumber, team1, team2, typewin, teamwin)
      VALUES (?, ?, ?, ?, ?)
    `;
  
    let team1score = 0;
    let team2score = 0;
    let winner = null;

    
    if (dataToSend.teamname === "team1") {
      team1score = messageData.won;
      team2score = messageData.lost;
    } else {
      team1score = messageData.lost;
      team2score = messageData.won;
    }
    // Retrieve scores of the previous round from the database
    db.get(`SELECT team1, team2 FROM "match" WHERE roundnumber = ?`, [roundNumber - 1], (err, prevRoundData) => {
      if (err) {
        console.error("Error fetching previous round data:", err.message);
        return;
      }
      
      // Compare the scores with the previous round
      if (prevRoundData) {
        const prevTeam1Score = parseInt(prevRoundData.team1);
        const prevTeam2Score = parseInt(prevRoundData.team2);

        // Determine the winner based on the comparison
        if (team1score > prevTeam1Score ) {
          winner = 'team1';
      } else if (team2score > prevTeam2Score ) {
          winner = 'team2';
      } else {
          // If scores are not higher than the previous round, there is no winner
          winner = 'No winner';
      }
      
      } else {
        // If there's no previous round data, there's no winner
        winner = 'No winner';
      }
  
      // Insert the match data into the database with the determined winner
      db.run(query, [roundNumber, team1score, team2score, typeWin, winner], (err) => {
        if (err) {
          console.error("Error inserting match data:", err.message);
        } else {
          console.log("Match data inserted successfully.");
        }
      });
    });
  }
  
  
  }

  // Send the data to WebSocket clients connected to broadcast endpoint
  sendDataToWebSocket(dataToSend);

  // Respond with a success message
  res.status(200).json({ message: "Data received successfully" });
});

app.get("/players", (req, res) => {
  // Query to select all rows from the "player" table
  const query = `
    SELECT * FROM player
  `;

  // Execute the query
  db.all(query, (err, rows) => {
    if (err) {
      console.error("Error executing query:", err.message);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      // Send the rows as JSON
      res.json(rows);
    }
  });
});
app.get("/latest-round", (req, res) => {
  // Query to select the row with the highest round number from the "match" table
  const query = `
    SELECT * FROM match
    ORDER BY roundnumber DESC
    LIMIT 1
  `;

  // Execute the query
  db.get(query, (err, row) => {
    if (err) {
      console.error("Error executing query:", err.message);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      // Send the row as JSON
      res.json(row);
    }
  });
});
// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
const calculateRoundNumber = (data) => {
  return data.won + data.lost;
};



app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const clientId = uuidv4();

  // Add the client response object to the SSE clients array
  sseClients.push({ id: clientId, res });

  // Send an initial message to establish connection
  res.write(`event: connection_established\n`);
  res.write(`id: ${clientId}\n`);
  res.write(`data: Connected to server\n\n`);

  // Cleanup when client disconnects
  req.on('close', () => {
    sseClients = sseClients.filter((client) => client.id !== clientId);
  });
});

app.get('/matchupdetails', (req, res) => {
  const query = 'SELECT * FROM matchupdetails';

  db.get(query, [], (err, rows) => {
    if (err) {
      console.error('Error querying database:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json(rows);
    }
  });
});



app.get('/roundscore', (req, res) => {
  const query = 'SELECT * FROM match';

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error querying database:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json(rows);
    }
  });
});


app.get('/mappick', (req, res) => {
  fs.readFile('mapspick.json', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      res.status(500).send('Internal Server Error');
      return;
    }
    
    const mapPickData = JSON.parse(data);
    res.json(mapPickData);
  });
});