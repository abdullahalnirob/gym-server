const express = require("express");
const app = express();
const cors = require("cors");
const port = 3000;
const { ObjectId } = require("mongodb");
const cookieParser = require("cookie-parser");
const { MongoClient } = require("mongodb");
require("dotenv").config();

// middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(cors(
  {
    origin: "http://localhost:5173",
    credentials: true,
  }
));

// mongodb
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const database = client.db("Gym");
const usercollection = database.collection("allUsers");
const pendingtrainer = database.collection("pendingTriainer");

async function run() {
  try {
    await client.connect();
    console.log(`Mongodb is connected..`);
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}
run().catch(console.dir);

// routes
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/api/users", async (req, res) => {
  const user = req.body;

  try {
    const existingUser = await usercollection.findOne({ email: user.email });
    if (existingUser) {
      console.log(user);
      return res.status(409).send({ message: "User already exists" });
    }

    const result = await usercollection.insertOne(user);
    res
      .status(201)
      .send({ message: "User inserted", userId: result.insertedId });
  } catch (error) {
    console.error("User insert error:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/api/allusers", async (req, res) => {
  try {
    const users = await usercollection.find().toArray();
    res.status(200).send({ users: users });
  } catch (error) {
    res.status(400).send({ message: "Something error in server." });
  }
});

app.get("/api/user", async (req, res) => {
  const { _id } = req.query;

  if (!_id) {
    return res.status(400).json({ error: "_id query parameter is required" });
  }

  // Validate ObjectId
  if (!ObjectId.isValid(_id)) {
    return res.status(400).json({ error: "Invalid _id format" });
  }

  try {
    const user = await usercollection.findOne({ _id: new ObjectId(_id) });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/pendingtrainer", async (req, res) => {
  const user = req.body;
  try {
    const result = await pendingtrainer.insertOne(user);
    res.status(200).send({ users: result });
  } catch (error) {
    res.status(400).send({ message: "Data is not inserted" });
  }
});

app.get("/api/pendingtrainer", async (req, res) => {
  try {
    const users = await pendingtrainer.find().toArray();
    res.status(200).send({ users: users });
  } catch (error) {
    res.status(400).send({ message: "Something error in server." });
  }
});

app.delete("/api/pendingtrainer/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pendingtrainer.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Document deleted" });
    } else {
      res.status(404).json({ message: "Document not found" });
    }
  } catch (err) {
    res.status(500).json({ error: "Invalid ID or server error" });
  }
});

app.patch("/api/users", async (req, res) => {
  const {
    trainerEmail,
    trainerName,
    role,
    trainerSkills,
    trainerAvailableDays,
    availableSlots,
    socials,
    experence,
  } = req.body;

  if (!trainerEmail) {
    return res.status(400).json({ error: "Missing trainerEmail" });
  }

  try {
    const filter = { email: trainerEmail };

    const updateDoc = {
      $set: {
        name: trainerName,
        role: role || "trainer",
        skills: trainerSkills,
        availableDays: trainerAvailableDays,
        availableSlots: availableSlots,
        socials,
        experience: experence,
        status: "approved",
      },
    };

    const result = await usercollection.updateOne(filter, updateDoc);

    if (result.modifiedCount > 0) {
      res.status(200).json({ message: "Trainer info updated successfully" });
    } else {
      res.status(404).json({ error: "User not found or already updated" });
    }
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Server error while updating trainer" });
  }
});

// Fixed endpoint - এখানে সমস্যা সমাধান করা হয়েছে
app.patch("/api/users/role-to-user/:id", async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ 
      success: false,
      message: "Invalid user ID format" 
    });
  }

  try {
    // প্রথমে চেক করি যে user exists কিনা এবং trainer role আছে কিনা
    const existingUser = await usercollection.findOne({ 
      _id: new ObjectId(id), 
      role: "trainer" 
    });

    if (!existingUser) {
      return res.status(404).json({ 
        success: false,
        message: "Trainer not found or user is not a trainer" 
      });
    }

    // এবার update করি
    const result = await usercollection.updateOne(
      { _id: new ObjectId(id), role: "trainer" },
      {
        $set: { role: "user", status: "disapproved" },
        $unset: {
          skills: "", 
          socials: "", 
          availableDays: "", 
          availableSlots: "", 
          experience: ""
        }
      }
    );

    if (result.modifiedCount > 0) {
      res.json({ 
        success: true,
        message: "Trainer role successfully changed to user" 
      });
    } else {
      res.status(400).json({ 
        success: false,
        message: "Failed to update trainer role" 
      });
    }

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
});

app.listen(port, () => {
  console.log(`server is running at http://localhost:${port}`);
});