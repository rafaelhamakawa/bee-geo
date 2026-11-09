import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
const ApiaryMap = lazy(() => import("@/components/apiary-map"));
export const Route = createFileRoute("/teste-mapa")({ ssr: false, component: () => (
  <Suspense fallback={null}><ApiaryMap latitude={-15.79} longitude={-47.88} nearby={[{latitude:-15.80,longitude:-47.87}]} className="h-96 w-full" /></Suspense>) });
