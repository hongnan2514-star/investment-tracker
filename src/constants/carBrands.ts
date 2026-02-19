export interface CarBrand {
  id: string;
  name: string;
  logoUrl?: string;
}

export const CAR_BRANDS: CarBrand[] = [
  { id: 'audi', name: '奥迪', logoUrl: '/logos/audi.png' },
  { id: 'bmw', name: '宝马', logoUrl: '/logos/bmw.png' },
  { id: 'benz', name: '奔驰', logoUrl: '/logos/mercedes.png' },
  { id: 'toyota', name: '丰田', logoUrl: '/logos/toyota.png' },
  { id: 'honda', name: '本田', logoUrl: '/logos/honda.png' },
  { id: 'nissan', name: '日产', logoUrl: '/logos/nissan.png' },
  { id: 'volkswagen', name: '大众', logoUrl: '/logos/vw.png' },
  { id: 'porsche', name: '保时捷', logoUrl: '/logos/porsche.png' },
  { id: 'ferrari', name: '法拉利', logoUrl: '/logos/ferrari.png' },
  { id: 'lamborghini', name: '兰博基尼', logoUrl: '/logos/lamborghini.png' },
  { id: 'mazda', name: '马自达', logoUrl: '/logos/mazda.png' },
  { id: 'subaru', name: '斯巴鲁', logoUrl: '/logos/subaru.png' },
  { id: 'mitsubishi', name: '三菱', logoUrl: '/logos/mitsubishi.png' },
  { id: 'lexus', name: '雷克萨斯', logoUrl: '/logos/lexus.png' },
  { id: 'infiniti', name: '英菲尼迪', logoUrl: '/logos/infiniti.png' },
  { id: 'acura', name: '讴歌', logoUrl: '/logos/acura.png' },
  { id: 'volvo', name: '沃尔沃', logoUrl: '/logos/volvo.png' },
  { id: 'landrover', name: '路虎', logoUrl: '/logos/landrover.png' },
  { id: 'jaguar', name: '捷豹', logoUrl: '/logos/jaguar.png' },
  { id: 'maserati', name: '玛莎拉蒂', logoUrl: '/logos/maserati.png' },
  { id: 'byd', name: '比亚迪', logoUrl: '/logos/byd.png' },
  { id: 'tesla', name: '特斯拉', logoUrl: '/logos/tesla.png' },
  { id: 'nio', name: '蔚来', logoUrl: '/logos/nio.png' },
  { id: 'xpeng', name: '小鹏', logoUrl: '/logos/xpeng.png' },
  { id: 'li', name: '理想', logoUrl: '/logos/li.png' },
  // 可以根据需要继续添加
];