// notification.model.ts
export interface Notification {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    image: string;
  };
  relatedEntity?: {
    id: string;
    type: string;
  };
}