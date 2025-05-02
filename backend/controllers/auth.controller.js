import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const google = async (req, res, next) => {
  const { email, name, googlePhotoUrl } = req.body;

  try {
    const user = await User.findOne({ email });

    const JWT_SECRET = "Surya02@s";

    if (user) {
      const token = jwt.sign({ id: user._id }, JWT_SECRET);

      const { password, ...rest } = user._doc;

      res
        .status(200)
        .cookie("access_token", token, {
          httpOnly: false,
          sameSite: "None",
          secure: true,
        })
        .json({ ...rest, access_token: token });
    } else {
      const generatedPassword =
        Math.random().toString(36).slice(-9) +
        Math.random().toString(36).slice(-9);

      const hashedPassword = bcrypt.hashSync(generatedPassword, 10);
      const username =
        name.toLowerCase().split(" ").join("") +
        Math.random().toString(9).slice(-4);

      const newUser = new User({
        username: username,
        email,
        password: hashedPassword,
        profilePicture: googlePhotoUrl,
      });

      await newUser.save();

      // console.log("JWT Secret: " + process.env.JWT_SECRET);

      const token = jwt.sign({ id: newUser._id }, JWT_SECRET);

      console.log("Token Generated: " + token);

      const { password, ...rest } = newUser._doc;

      res
        .status(200)
        .cookie("access_token", token, {
          httpOnly: false,
          sameSite: "None",
          secure: true,
        })
        .json({ ...rest, access_token: token });
    }
  } catch (error) {
    next(error);
  }
};
