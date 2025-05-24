<p align="center">
  <img src="frontend/public/Logo - Trans.png" alt="SunoSuno Logo" width="200">
</p>

# SunoSuno

A modern web application built with React and Node.js, featuring real-time communication capabilities.

## 🚀 Features

- Real-time communication using Socket.IO
- Modern UI with Tailwind CSS and DaisyUI
- Secure authentication system
- Cloud storage integration with Cloudinary
- Responsive design

## 🛠️ Tech Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- DaisyUI
- Socket.IO Client
- Zustand (State Management)
- React Router DOM
- Axios
- React Hot Toast

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- Socket.IO
- JWT Authentication
- Bcrypt for password hashing
- Cloudinary for file storage

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/Ankanpanda/SunoSuno.git
cd SunoSuno
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

4. Create a `.env` file in the backend directory with the following variables:
```env
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

## 🚀 Running the Application

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. Start the frontend development server:
```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:5173` (frontend) and `http://localhost:3000` (backend).

## 📝 Scripts

### Backend
- `npm run dev`: Start the development server with nodemon
- `npm start`: Start the production server

### Frontend
- `npm run dev`: Start the development server
- `npm run build`: Build for production
- `npm run preview`: Preview the production build
- `npm run lint`: Run ESLint

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details. 