export type FuelType = "diesel" | "e5" | "e10";
export type VehicleType = "pkw" | "transporter";
export type RoadEventType = "closure" | "warning" | "roadworks";

export type TrafficEvent = {
  id: string;
  road: string;
  type: RoadEventType;
  future?: boolean;
  title: string;
  subtitle: string;
  description: string;
};

export type TrafficResponse = {
  status: "ok" | "partial" | "error";
  checkedAt: string;
  roads: string[];
  events: TrafficEvent[];
  errors: string[];
  scope: "motorway-wide";
};

export type Station = {
  id: string;
  name: string;
  brand: string;
  address: string;
  price: number;
  distanceKm: number;
  isOpen: boolean;
  lat: number;
  lng: number;
};

export type FuelSnapshot = {
  checkedAt: string;
  type: FuelType;
  stations: Station[];
  source: string;
  scope: "near-current-position";
};

export type Trip = {
  origin: string;
  destination: string;
  roads: string[];
  vehicle: VehicleType;
  fuelType: FuelType;
  createdAt: string;
  fuel: FuelSnapshot | null;
};
