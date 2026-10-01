import { NotFoundError } from "@/server/errors";
import { findUserById, type User } from "@/server/users/user-repository";

export async function existingUser(id: string): Promise<User> {
  const user = await findUserById(id);
  if (!user) throw new NotFoundError();
  return user;
}
