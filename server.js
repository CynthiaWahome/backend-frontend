// Load environment variables from a .env file
require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const path = require("path");
const cors = require("cors");
const { check, validationResult } = require("express-validator");

// Initialization
const app = express();

// Configure middleware for handling the interaction between frontend and backend
app.use(express.static(path.join(__dirname, "./public"))); // Serve static files from the 'public' directory
app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Configure session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: false,
  }),
);

// Create a connection to the database
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: "expense_tracker",
});

// Connect to the database
db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log("Connected to MySQL as id: ", db.threadId);

  // Create users and expenses tables if they don't exist
  const usersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(100) NOT NULL UNIQUE,
            username VARCHAR(50) NOT NULL,
            password VARCHAR(255)
        )
    `;

  const expensesTable = `
        CREATE TABLE IF NOT EXISTS expenses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            user_id INT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `;

  db.query(usersTable, (err) => {
    if (err) return console.log(err);
    console.log("Users table created or already exists");
  });

  db.query(expensesTable, (err) => {
    if (err) return console.log(err);
    console.log("Expenses table created or already exists");
  });
});

// Define a route to the registration form
app.get("/register", (request, response) => {
  response.sendFile(path.join(__dirname, "./public/register.html"));
});

// Display login page
app.get("/login", (request, response) => {
  response.sendFile(path.join(__dirname, "/public/login.html"));
});

// Define user registration route
app.post(
  "/api/user/register",
  [
    check("email").isEmail().withMessage("Provide a valid email address."),
    check("username")
      .isAlphanumeric()
      .withMessage("Invalid username. Provide alphanumeric values"),
    check("password", "Password must be at least 6 characters long").isLength({
      min: 6,
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    console.log(errors);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { full_name, email, username, password } = req.body;

    // Check if email or username already exists
    db.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [email, username],
      async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
          return res
            .status(400)
            .json({ message: "Email or username already exists" });
        }

        // Hash password with bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Define a new user object
        const newUser = {
          email,
          username,
          password: hashedPassword,
        };

        // Save new user to the database
        db.query("INSERT INTO users SET ?", newUser, (error) => {
          if (error) {
            console.error(
              "An error occurred while saving the record: " + error.message,
            );
            return res.status(500).json({ error: error.message });
          }
          console.log("New User record has been saved!");
          res.status(201).json({ message: "Registration successfull" });
        });
      },
    );
  },
);

// Define user login route
app.post(
  "/api/user/login",
  [
    check("email", "Email is not valid").isEmail(),
    check("password", "Password is required").not().isEmpty(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });

      if (results.length === 0) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const user = results[0];

      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!isMatch) {
          return res.status(401).json({ message: "Invalid email or password" });
        }

        req.session.userId = user.id;
        res.status(200).json({ message: "Login successful" });
      });
    });
  },
);

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// CRUD operations for expenses

// Create expense (authenticated route)
app.post("/expenses", isAuthenticated, (req, res) => {
  const { name, amount } = req.body;
  const query = "INSERT INTO expenses (name, amount, user_id) VALUES (?, ?, ?)";
  db.query(query, [name, amount, req.session.userId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    res.status(201).json({ id: result.insertId, name, amount });
  });
});

// Read all expenses (authenticated route)
app.get("/expenses", isAuthenticated, (req, res) => {
  const query = "SELECT * FROM expenses WHERE user_id = ?";
  db.query(query, [req.session.userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    res.status(200).json(results);
  });
});

// Update expense (authenticated route)
app.put("/expenses/:id", isAuthenticated, (req, res) => {
  const { id } = req.params;
  const { name, amount } = req.body;
  const query =
    "UPDATE expenses SET name = ?, amount = ? WHERE id = ? AND user_id = ?";
  db.query(query, [name, amount, id, req.session.userId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    res.status(200).json({ message: "Expense updated successfully" });
  });
});

// Delete expense (authenticated route)
app.delete("/expenses/:id", isAuthenticated, (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM expenses WHERE id = ? AND user_id = ?";
  db.query(query, [id, req.session.userId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    res.status(200).json({ message: "Expense deleted successfully" });
  });
});

// Start the server
const port = process.env.PORT;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
