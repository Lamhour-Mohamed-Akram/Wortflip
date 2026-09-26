-- Removes the rows created by the author's end-to-end test (devices "test-device-*").
delete from public.topics where device like 'test-device-%';
