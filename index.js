const bodyParser = require("body-parser");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const port =process.env.PORT || 3000;
app.use(cors());
// app.use(cors({origin: true, credentials: true}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

mongoose
  .connect(
    "mongodb+srv://kuchimittai174:shiraz@cluster0.tyqdi6e.mongodb.net/",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("connected to mongodb ***");
  })
  .catch((err) => {
    console.log("Error connecting to mongodb ***");
  });

app.listen(port,() => {
  console.log(`server is running on ${port}`);
});

const User = require("./models/user");
const Post = require("./models/post");
const { log } = require("console");

app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered!!!" });
    }
    //create a new user
    const newUser = new User({ name, email, password });
    //gen and store verification token
    newUser.verificationToken = crypto.randomBytes(20).toString("hex");
    //save the user to database
    await newUser.save();
    //send verification email to the user
    sendVerificationEmail(newUser.email, newUser.verificationToken);

    res.status(200).json({ message: "registration successful" });
  } catch (error) {
    console.log("Error registering user", error);
  }
});

const sendVerificationEmail = async (email, verificationToken) => {
  //create a nodemailer transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "blackboytechie@gmail.com",
      pass: "izmo djvj zegw qbwt",
    },
  });
  //compose the email message
  const mailOptions = {
    from: "threads.com",
    to: email,
    subject: "Email Verification",
    text: `please click the following link to verify your email http://192.168.1.37:3000/verify/${verificationToken}`,
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (e) {
    console.log("error sending email", e);
  }
};
//endpoint to update verification in db
app.get("/verify/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(404).json({ message: "Invalid token" });
    }
    user.verified = true;
    user.verificationToken = undefined;
    await user.save();
    res.status(200).json({ message: "Email verified successfully" });
  } catch (e) {
    console.log("error getting token", e);
    res.status(500).json({ message: "email verification failed" });
  }
});

const generateSecretKey = () => {
  const secretKey = crypto.randomBytes(32).toString("hex");
  return secretKey;
};
const secretKey = generateSecretKey();

//endpoint for login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Invalid email" });
    }
    if (user.password !== password) {
      return res.status(404).json({ message: "Invalid password" });
    }
    const token = jwt.sign({ userId: user._id }, secretKey);
    res.status(200).json({ token });
  } catch (e) {
    res.status(500).json({ message: "login failed" });
  }
});
//endpoint to access currentuser
app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
//endpoint to access all the users except the logged in user

app.get("/user/:userId", (req, res) => {
  try {
    const LoggedInUser = req.params.userId;
    User.find({ _id: { $ne: LoggedInUser } })
      .then((users) => {
        // console.log('backend users:',users);
        res.status(200).json(users);
      })
      .catch((er) => {
        console.log("Error :", er);
        res.status(500).json({ message: "Error getting user" });
      });
  } catch (er) {
    res.status(500).json({ message: "error getting the user***" });
  }
});

//endpoint to follow particular user
app.post("/follow", async (req, res) => {
  const { currentUserId, selectedUserId } = req.body;
  try {
    await User.findByIdAndUpdate(selectedUserId, {
      $push: { followers: currentUserId },
    });
    res.sendStatus(200);
  } catch (err) {
    console.log("error is ", err);
    res.status(500).json({ message: "error in following user" });
  }
});

//endpoint to unfollow a user
app.post("/users/unfollow", async (req, res) => {
  const { loggedInUserId, targetUserId } = req.body;
  try {
    await User.findByIdAndUpdate(targetUserId, {
      $pull: { followers: loggedInUserId },
    });
    res.sendStatus(200);
  } catch (err) {
    console.log("error:", err);
    res.status(500).json({ message: "Error unfollowing a user" });
  }
});

//endpoint to post content to backend
app.post("/create-post", async (req, res) => {
  try {
    const { userId, content } = req.body;
    const newPostData = {
      user: userId,
    };
    if (content) {
      newPostData.content = content;
    }
    const newPost = new Post(newPostData);
    await newPost.save();
    res.status(200).json({ message: "post saved successfully" });
  } catch (err) {
    res.status(500).json({ message: "post creation failed" });
  }
});

//endpoint to like a particular post
app.put("/posts/:postId/:userId/like", async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.params.userId;
    // console.log("postId backend :", postId);
    // console.log("userId backend :", userId);
    const post = await Post.findById(postId).populate("user", "name");
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        $addToSet: { likes: userId },
      },
      { new: true }
    );
    updatedPost.user = post.user;
    if (!updatedPost) {
      res.status(404).json({ message: "post not found" });
    }
    res.status(200).json(updatedPost);
  } catch (err) {
    console.log("error in like a post");
    res.status(500).json({ message: "error occured while like a post" });
  }
});
//endpoint to unlike a particular post
app.put("/posts/:postId/:userId/unlike", async (req, res) => {
  try {
    // const postId = req.params.postId;
    // const userId = req.params.userId;

    const post = await Post.findById(postId).populate("user", "name");
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        $pull: { likes: userId },
      },
      { new: true }
    );
    updatedPost.user = post.user;
    if (!updatedPost) {
      res.status(404).json({ message: "post not found" });
    }
    res.status(200).json(updatedPost);
  } catch (err) {
    console.log("error in like a post");
    res.status(500).json({ message: "occured while like a post" });
  }
});
//endpoint to get all post
app.get("/get-posts", async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "name")
      .sort({ created_at: -1 });
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: "error geting all post" });
  }
});
//endpoint to fetch 10 random users
app.get("/random-users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the current user by ID
    const currentUser = await User.findById(userId);
    console.log(currentUser);

    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }
    const randomUsers = await User.aggregate([
      // { $match: { $or: [{ _id:currentUser._id }, { followers: mongoose.Types.ObjectId(currentUser._id) }] } },
      {$match : {followers:{$ne:currentUser._id},_id:{$ne:currentUser._id}}},
      { $sample: { size: 10 } }, // Fetch 10 random users
    ]);
    // const randomUsers = await User.find({
    //   followers:{$ne:currentUser._id},
    // });
    res.json(randomUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
//endpoint to get current user profile
app.get('/profile/:userId',async(req,res)=>{
try {
  const userId = req.params.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
    console.log('userdetail backend',user);
} catch (error) {
  res.status(500).json({ message: "Error while getting the profile" });
}
});