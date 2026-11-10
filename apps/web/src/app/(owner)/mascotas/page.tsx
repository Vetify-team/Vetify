import type { Metadata } from "next";
import { MyPets } from "@/components/pets/my-pets";

export const metadata: Metadata = { title: "Mis mascotas" };

export default function Page() {
  return <MyPets />;
}
