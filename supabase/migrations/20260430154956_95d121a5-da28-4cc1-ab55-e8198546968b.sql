INSERT INTO public.user_roles (user_id, role)
VALUES ('afba0608-74ac-4531-b303-eabd9f10ab95', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;