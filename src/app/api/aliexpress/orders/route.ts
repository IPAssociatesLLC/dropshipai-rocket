import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  dsOrderCreate,
  dsOrderAfterPay,
  dsOrderTrackingGet,
  tradeOrderGet,
  type AliDsCredentials,
} from '@/lib/aliexpress-ds';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, action, ...params } = body as {
      userId: string;
      action: 'create' | 'afterpay' | 'tracking' | 'details';
      [key: string]: unknown;
    };

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, message: 'userId and action are required.' },
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

    switch (action) {
      case 'create': {
        const { productItems, logisticsAddress, outOrderId } = params as {
          productItems: Array<{ product_id: string; product_count: number; sku_attr?: string; logistics_service_name?: string }>;
          logisticsAddress: { contact_person: string; address: string; city: string; province?: string; country: string; zip: string; mobile_no?: string };
          outOrderId?: string;
        };
        if (!productItems?.length || !logisticsAddress) {
          return NextResponse.json({ success: false, message: 'productItems and logisticsAddress are required for order creation.' }, { status: 400 });
        }
        result = await dsOrderCreate(dsCreds, {
          product_items: productItems,
          logistics_address: logisticsAddress,
          out_order_id: outOrderId,
        });
        break;
      }

      case 'afterpay': {
        const { orderId } = params as { orderId: string };
        if (!orderId) return NextResponse.json({ success: false, message: 'orderId is required.' }, { status: 400 });
        result = await dsOrderAfterPay(dsCreds, orderId);
        break;
      }

      case 'tracking': {
        const { orderId } = params as { orderId: string };
        if (!orderId) return NextResponse.json({ success: false, message: 'orderId is required.' }, { status: 400 });
        result = await dsOrderTrackingGet(dsCreds, orderId);

        // If tracking succeeds, update the order in Supabase
        if (result.success && result.data) {
          const trackData = result.data as Record<string, unknown>;
          const trackingInfo = trackData?.tracking_info as Record<string, unknown> | undefined;
          if (trackingInfo) {
            await supabase
              .from('orders')
              .update({
                tracking_number: trackingInfo.tracking_number as string || '',
                carrier: trackingInfo.logistics_no as string || '',
                status: 'shipped',
                shipped_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId)
              .eq('bonanza_order_id', orderId);
          }
        }
        break;
      }

      case 'details': {
        const { orderId } = params as { orderId: string };
        if (!orderId) return NextResponse.json({ success: false, message: 'orderId is required.' }, { status: 400 });
        result = await tradeOrderGet(dsCreds, orderId);
        break;
      }

      default:
        return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: `AliExpress API error (${result.errorCode}): ${result.errorMsg}`,
      });
    }

    return NextResponse.json({ success: true, data: result.data, action });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message: `Server error: ${msg}` }, { status: 500 });
  }
}
