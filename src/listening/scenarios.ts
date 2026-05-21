/**
 * Scenario images for JLPT listening topics.
 * Free Unsplash URLs — reliable CDN, no attribution required for display.
 */

export interface ScenarioTopic {
  keywords: string[]
  image: string
  alt: string
}

const SCENARIOS: ScenarioTopic[] = [
  {
    keywords: ['コーヒー', '喫茶', 'カフェ', 'coffee', 'cafe', 'shop', '注文'],
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200&q=80',
    alt: 'Japanese coffee shop interior',
  },
  {
    keywords: ['駅', '電車', '乗り換え', 'train', 'station', 'platform', '新幹線'],
    image: 'https://images.unsplash.com/photo-1535535112387-56ffe8db21ff?w=1200&q=80',
    alt: 'Japanese train station platform',
  },
  {
    keywords: ['会社', '会議', 'オフィス', 'office', 'meeting', 'work', 'business'],
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80',
    alt: 'Office meeting room',
  },
  {
    keywords: ['レストラン', '料理', '食べ物', 'restaurant', 'food', 'dinner', 'lunch'],
    image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=80',
    alt: 'Japanese restaurant',
  },
  {
    keywords: ['病院', '医者', 'hospital', 'doctor', 'clinic', 'medical'],
    image: 'https://images.unsplash.com/photo-1587351021759-3e566b2af611?w=1200&q=80',
    alt: 'Hospital reception',
  },
  {
    keywords: ['学校', '教室', '先生', 'school', 'classroom', 'teacher', 'student'],
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&q=80',
    alt: 'Classroom',
  },
  {
    keywords: ['空港', '飛行機', 'airport', 'plane', 'flight', 'travel'],
    image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&q=80',
    alt: 'Airport terminal',
  },
  {
    keywords: ['ホテル', '旅館', 'hotel', 'ryokan', 'room', 'checkin'],
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80',
    alt: 'Hotel lobby',
  },
  {
    keywords: ['郵便局', '郵便', 'post', 'mail', 'letter', 'package'],
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&q=80',
    alt: 'Post office',
  },
  {
    keywords: ['買い物', 'スーパー', 'ショッピング', 'shopping', 'supermarket', 'store'],
    image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=1200&q=80',
    alt: 'Supermarket',
  },
  {
    keywords: '銀行,ATM,お金,bank,money,withdraw'.split(','),
    image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200&q=80',
    alt: 'Bank interior',
  },
  {
    keywords: '図書館,本,library,book,read'.split(','),
    image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200&q=80',
    alt: 'Library',
  },
  {
    keywords: '公園,花見,park,cherry blossom,sakura'.split(','),
    image: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1200&q=80',
    alt: 'Cherry blossom park',
  },
  {
    keywords: '海,ビーチ,beach,ocean,swim,summer'.split(','),
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
    alt: 'Beach',
  },
  {
    keywords: '温泉,onsen,hot spring,bath'.split(','),
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&q=80',
    alt: 'Hot spring',
  },
  {
    keywords: '山,ハイキング,mountain,hike,nature'.split(','),
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80',
    alt: 'Mountain view',
  },
  {
    keywords: '雨,傘,rain,umbrella,weather'.split(','),
    image: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=1200&q=80',
    alt: 'Rainy street',
  },
  {
    keywords: '雪,冬,snow,winter,cold'.split(','),
    image: 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1200&q=80',
    alt: 'Snow scene',
  },
  {
    keywords: '花火,festival,fireworks,matsuri,summer'.split(','),
    image: 'https://images.unsplash.com/photo-1533561052669-021e3909ef65?w=1200&q=80',
    alt: 'Fireworks festival',
  },
  {
    keywords: '結婚式,ウエディング,wedding,marriage,ceremony'.split(','),
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80',
    alt: 'Wedding ceremony',
  },
]

export function getScenarioImage(text: string): string | undefined {
  const lower = text.toLowerCase()
  for (const s of SCENARIOS) {
    if (s.keywords.some(k => lower.includes(k.toLowerCase()))) {
      return s.image
    }
  }
  return undefined
}

export function getDefaultScenarioImage(): string {
  return 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=80'
}
