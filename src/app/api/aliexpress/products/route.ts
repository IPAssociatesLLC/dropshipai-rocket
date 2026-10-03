import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  dsProductGet,
  dsProductWholesaleGet,
  dsProductSpecialInfoGet,
  dsImageSearchV2,
  dsFeedItemIdsGet,
  dsMemberBenefitGet,
  dsCategoryTreeGet,
  dsCategoryGet,
  type AliDsCredentials,
} from '@/lib/aliexpress-ds';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, action, ...params } = body as {
      userId: string;
      action:
        | 'product_get' |'wholesale_get' |'special_info' |'image_search' |'feed_items' |'member_benefit' |'category_tree' |'category_get';
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
      case 'product_get': {
        const { productId, shipToCountry, targetCurrency, targetLanguage } = params as {
          productId: string;
          shipToCountry?: string;
          targetCurrency?: string;
          targetLanguage?: string;
        };
        if (!productId) return NextResponse.json({ success: false, message: 'productId is required.' }, { status: 400 });
        result = await dsProductGet(dsCreds, productId, {
          ship_to_country: shipToCountry,
          target_currency: targetCurrency,
          target_language: targetLanguage,
        });
        break;
      }

      case 'wholesale_get': {
        const { productId, shipToCountry, targetCurrency, targetLanguage } = params as {
          productId: string;
          shipToCountry?: string;
          targetCurrency?: string;
          targetLanguage?: string;
        };
        if (!productId) return NextResponse.json({ success: false, message: 'productId is required.' }, { status: 400 });
        result = await dsProductWholesaleGet(dsCreds, productId, {
          ship_to_country: shipToCountry,
          target_currency: targetCurrency,
          target_language: targetLanguage,
        });
        break;
      }

      case 'special_info': {
        const { productId } = params as { productId: string };
        if (!productId) return NextResponse.json({ success: false, message: 'productId is required.' }, { status: 400 });
        result = await dsProductSpecialInfoGet(dsCreds, productId);
        break;
      }

      case 'image_search': {
        const { imageBase64, pageNo, pageSize } = params as {
          imageBase64: string;
          pageNo?: number;
          pageSize?: number;
        };
        if (!imageBase64) return NextResponse.json({ success: false, message: 'imageBase64 is required.' }, { status: 400 });
        result = await dsImageSearchV2(dsCreds, imageBase64, {
          page_no: pageNo,
          page_size: pageSize,
        });
        break;
      }

      case 'feed_items': {
        const { feedName, searchId, pageSize } = params as {
          feedName: string;
          searchId?: string;
          pageSize?: number;
        };
        if (!feedName) return NextResponse.json({ success: false, message: 'feedName is required.' }, { status: 400 });
        result = await dsFeedItemIdsGet(dsCreds, feedName, { search_id: searchId, page_size: pageSize });
        break;
      }

      case 'member_benefit': {
        result = await dsMemberBenefitGet(dsCreds);
        break;
      }

      case 'category_tree': {
        const { parentCategoryId, language } = params as { parentCategoryId?: string; language?: string };
        result = await dsCategoryTreeGet(dsCreds, {
          parent_category_id: parentCategoryId,
          language,
        });
        break;
      }

      case 'category_get': {
        const { parentCategoryId, language } = params as { parentCategoryId?: string; language?: string };
        result = await dsCategoryGet(dsCreds, {
          parent_category_id: parentCategoryId,
          language,
        });
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
