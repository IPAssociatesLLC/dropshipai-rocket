import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { dsFreightQuery, freightCalculate, type AliDsCredentials } from '@/lib/aliexpress-ds';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      productId,
      productNum = 1,
      countryCode,
      provinceCode,
      cityCode,
      method = 'ds_freight', // 'ds_freight' | 'buyer_freight'
    } = body as {
      userId: string;
      productId: string;
      productNum?: number;
      countryCode: string;
      provinceCode?: string;
      cityCode?: string;
      method?: 'ds_freight' | 'buyer_freight';
    };

    if (!userId || !productId || !countryCode) {
      return NextResponse.json(
        { success: false, message: 'userId, productId, and countryCode are required.' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: aliCreds } = await supabase
      .from('api_credentials')
      .select('credentials')
      .eq('user_id', userId)
      .eq('service', 'aliexpress_ds')
      .single();

    const creds = aliCreds?.credentials as Record<string, string> | null;
    if (!creds?.appKey || !creds?.appSecret) {
      return NextResponse.json(
        { success: false, message: 'AliExpress DS API credentials not configured. Add them in API Connections.' },
        { status: 400 },
      );
    }

    const dsCreds: AliDsCredentials = {
      appKey: creds.appKey,
      appSecret: creds.appSecret,
      accessToken: creds.accessToken || undefined,
    };

    let result;
    if (method === 'buyer_freight') {
      result = await freightCalculate(dsCreds, {
        product_id: productId,
        product_num: productNum,
        country_code: countryCode,
        province_code: provinceCode,
        city_code: cityCode,
        send_goods_country_code: 'CN',
        price_currency: 'USD',
      });
    } else {
      result = await dsFreightQuery(dsCreds, {
        product_id: productId,
        product_num: productNum,
        ship_to_country: countryCode,
        send_goods_country_code: 'CN',
        price_currency: 'USD',
      });
    }

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: `Freight API error (${result.errorCode}): ${result.errorMsg}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      method,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message: `Server error: ${msg}` }, { status: 500 });
  }
}
