-- China cash box: add WeChat Pay next to Alipay (configuration requested by the business).
INSERT INTO public.payment_methods (id, country, code, label, kind, sort_order)
VALUES ('PM-CN-WECHAT', 'Chine', 'WECHAT', 'WeChat Pay', 'mobile', 4)
ON CONFLICT (country, code) DO NOTHING;
