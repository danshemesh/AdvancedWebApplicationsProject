declare global {
  namespace Express {
    // Extend Passport's empty User so req.user is typed for our app
    interface User {
      id: string;
      username: string;
      email: string;
    }
  }
}

export {};
