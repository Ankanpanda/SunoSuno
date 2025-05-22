import jwt from "jsonwebtoken";

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // MS
    httpOnly: true, // prevent XSS attacks cross-site scripting attacks
    sameSite: "lax", // Changed from strict to lax to allow cross-origin
    secure: process.env.NODE_ENV !== "development",
    path: "/",
    domain: process.env.NODE_ENV === "development" ? "https://suno-suno-delta.vercel.app" : undefined
  });

  res.setHeader("Access-Control-Expose-Headers", "Authorization");
  res.setHeader("Authorization", `Bearer ${token}`);
  
  res.locals.token = token;

  return token;
};
