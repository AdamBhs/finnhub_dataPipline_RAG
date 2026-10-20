import { createBrowserRouter } from "react-router-dom"
import RootLayout from "@/routes/root-layout"
import DashboardPage from "@/routes/dashboard"
import ChatPage from "@/routes/chat"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "chat", element: <ChatPage /> },
    ],
  },
])