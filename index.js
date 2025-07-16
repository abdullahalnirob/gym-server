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
app.use(
  cors({
    origin: ["http://localhost:5173","https://gimox.surge.sh"],
    credentials: true,
  })
);

// mongodb
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const database = client.db("Gym");
const usercollection = database.collection("allUsers");
const pendingtrainer = database.collection("pendingTriainer");
const classcollection = database.collection("classes");

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

app.patch("/api/users/role-to-user/:id", async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID format",
    });
  }

  try {
    const existingUser = await usercollection.findOne({
      _id: new ObjectId(id),
      role: "trainer",
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "Trainer not found or user is not a trainer",
      });
    }

    const result = await usercollection.updateOne(
      { _id: new ObjectId(id), role: "trainer" },
      {
        $set: { role: "user", status: "disapproved" },
        $unset: {
          skills: "",
          socials: "",
          availableDays: "",
          availableSlots: "",
          experience: "",
        },
      }
    );

    if (result.modifiedCount > 0) {
      res.json({
        success: true,
        message: "Trainer role successfully changed to user",
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to update trainer role",
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.patch("/api/user-to-admin/:id", async (req, res) => {
  const { id } = req.params;

  console.log("id at 167 line", id);

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid user ID format" });
  }

  try {
    const filter = {
      _id: new ObjectId(id),
      role: "user", 
    };

    const updateDoc = {
      $set: {
        role: "admin",
      },
    };

    const result = await usercollection.updateOne(filter, updateDoc);

    if (result.modifiedCount > 0) {
      res.status(200).json({ message: "User successfully promoted to admin" });
    } else {
      res
        .status(404)
        .json({ error: "User not found, already admin, or not a user" });
    }
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Server error while updating user role" });
  }
});

app.post("/api/classes", async (req, res) => {
  try {
    const data = req.body;
    const result = await classcollection.insertOne(data);
    return res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/classes", async (_req, res) => {
  try {
    const result = await classcollection.find().toArray();
    return res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});


app.delete("/api/classes/:id", async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid class ID" });
  }

  try {
    const result = await classcollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Class not found" });
    }

    res.json({ message: "Class deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Server error while deleting class" });
  }
});


app.listen(port, () => {
  console.log(`server is running at http://localhost:${port}`);
});
