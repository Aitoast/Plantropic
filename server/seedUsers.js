// server/seedUsers.js — 코드에 미리 적어둔 로그인 후보 계정.
import bcrypt from "bcryptjs";

export const FIXED_USERS = [
  { email: "aa@aa.com", password: "12345678", name: "사용자1" },
  { email: "bb@bb.com", password: "12345678", name: "사용자2" },
  { email: "cc@cc.com", password: "12345678", name: "관리자" },
  // 필요한 만큼 추가
];

export async function seedFixedUsers(db) {
  for (const u of FIXED_USERS) {
    const email = String(u.email).trim().toLowerCase();
    if (await db.findUserByEmail(email)) continue;   // 이미 있으면 건너뜀
    const password_hash = await bcrypt.hash(u.password, 12);
    const user = await db.createUser({ name: u.name, email, password_hash });
    await db.seedCalendars(user.id);
  }
  return FIXED_USERS.map((u) => u.email.toLowerCase());
}