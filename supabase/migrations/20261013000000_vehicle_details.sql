-- Optional vehicle details from the add/edit vehicle form.
alter table public.vehicles
  add column trim_level text check (trim_level is null or char_length(trim_level) <= 60),
  add column licence_plate text check (licence_plate is null or char_length(licence_plate) <= 10),
  add column tire_size text check (tire_size is null or char_length(tire_size) <= 30);
